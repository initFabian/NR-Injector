

module.exports = function(RED) {
    "use strict";
    var os = require('os');

    RED.httpAdmin.get('/injector/ip', function (req, res) {
        //http://stackoverflow.com/questions/3653065/get-local-ip-address-in-node-js
        var ifaces = os.networkInterfaces();
        Object.keys(ifaces).forEach(function (ifname) {
            var alias = 0;
            ifaces[ifname].forEach(function (iface) {
              if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(ifname + ':' + alias, iface.address);
                res.send('Multiple addresses detected');
            } else {
                // this interface has only one ipv4 adress
                console.log(ifname, iface.address);
                res.send(iface.address);
            }
        });
        });
    });
    var injector_nodes = [];

    function injectorManager(n) {
        // Create a RED node
        RED.nodes.createNode(this,n);

        this.password = n.password;

        var node = this;

        this.errorHandler = function(err,req,res,next) {
            node.warn(err);
            res.send(401);
        };

        this.checkAuth = function(req,res,next) {
            if (req.get('AUTH') === node.password) {
                next();
            } else {
                //console.log(req.get('AUTH'));
                //console.log(node.password);
                next(new Error('Injector - Authentication Error'));
            }
        };

        this.getNodes = function(req,res) {
            var response = []
            injector_nodes.map(function (curr, index, arr) {
                this.push({
                    id: curr.id,
                    name: curr.name,
                    payloadType: curr.payloadType,
                    payload: curr.payload
                })
            },response);
            res.json(response);
        };

        this.inject = function(req,res) {
            if (req.query.id) {
                var msg = {payload:""};
                var node = RED.nodes.getNode(req.query.id);
                if ( (node.payloadType == null && node.payload == "") || node.payloadType == "date") {
                    msg.payload = Date.now();
                } else if (node.payloadType == null || node.payloadType == "string") {
                    msg.payload = node.payload;
                } else {
                    msg.payload = "";
                }
                node.send(msg);
                msg = null;
                res.json({'status': 'ok'});
            }

        };

        var configStatus = function(req,res) {
            res.json({'status':'OK'});
        };

        RED.httpNode.get('/injector/nodes',this.checkAuth,this.getNodes,this.errorHandler);
        RED.httpNode.get('/injector/inject',this.checkAuth,this.inject,this.errorHandler);
        RED.httpNode.get('/injector/status', configStatus);

        this.on('close', function() {
            injector_nodes = [];
        });
    }

    RED.nodes.registerType("injector-manager", injectorManager);

    injectorManager.prototype.registerInputNode = function(handler){
        this._inputNodes.push(handler);
    }

    function injectorInNode(n) {
        RED.nodes.createNode(this,n);
        this.manager = n.manager;
        this.payload = n.payload;
        this.payloadType = n.payloadType;
        var node = this;
        this.serverConfig = RED.nodes.getNode(this.manager);
        if (this.serverConfig) {
            //console.log('found server config');
            injector_nodes.push(node);
        } else {
            this.error("Missing server configuration");
        }
    }

    RED.nodes.registerType("NR Injector in", injectorInNode);

}
