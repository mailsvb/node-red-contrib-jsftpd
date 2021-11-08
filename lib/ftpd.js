module.exports = RED => {
    const util = require('util')
    const { ftpd } = require('jsftpd')

    const State = Object.freeze({
        Undefined: 'Undefinded',
        Initialized: 'Initialized',
        Starting: 'Starting',
        Running: 'Running',
        Stopping: 'Stopping'
    })

    function jsftpdServerNode(n) {
        RED.nodes.createNode(this, n)
        if (!n || !n._users || !n._users.length) {
            // if no nodes use this server return
            return
        }
        const node = this
        node.port = n.port || 21
        node.username = n.username || ''
        node.password = node.credentials.password || ''
        node.subscriptions = {}
        node.state = State.Undefinded
        node.running = false

        // broadcast events to subscribed nodes
        node.broadcast = (type, data) => {
            node.log(`broadcasting: type[${type}] data[${util.inspect(data, { showHidden: true, depth: null })}]`)
            for (const id in node.subscriptions) {
                if (node.subscriptions[id].hasOwnProperty(type)) {
                    node.debug(`broadcasting: type[${type}] id[${id}]`)
                    if (type === 'state') {
                        let shape, fill
                        switch (node.state) {
                            case State.Initialized:
                                shape = 'ring'
                                fill = 'yellow'
                                break
                            case State.Starting:
                                shape = 'ring'
                                fill = 'green'
                                break
                            case State.Running:
                                shape = 'dot'
                                fill = 'green'
                                break
                            case State.Stopping:
                                shape = 'dot'
                                fill = 'red'
                                break
                            default:
                                shape = 'dot'
                                fill = 'grey'
                        }
                        node.subscriptions[id][type]({fill: fill, shape: shape, text: data || node.state})
                    } else {
                        node.subscriptions[id][type]({data: data})
                    }
                }
            }
        };

        // subscribe and unsubscribe handling
        node.subscribe = (id, type, cb) => {
            node.log('receive subscribe for >' + type + '< from >' + id + '<');
            node.subscriptions[id] = node.subscriptions[id] || {};
            node.subscriptions[id][type] = cb;
            if (type === 'state') {
                node.broadcast('state', node.state);
            }
        };
        node.unsubscribe = (id, type) => {
            if (node.subscriptions[id].hasOwnProperty(type)) {
                delete node.subscriptions[id][type];
            }
            if (Object.keys(node.subscriptions[id]).length === 0 || type === '') {
                delete node.subscriptions[id];
            }
        };

        if (!node.port || !node.username || !node.password) {
            node.error('username, password and port are required values')
            node.state = State.Undefinded
            node.broadcast('state', 'username, password and port are required values')
            return
        }

        async function uploadHandler(name, path, fileName, data, offset) {
            node.broadcast('upload', {name: name, path: path, fileName: fileName, data: data, offset: offset})
            return true
        }

        const config = {
            port: node.port,
            username: node.username,
            password: node.password
        }
        const handler = {
            upload: uploadHandler
        }
        if (!node.instance) {
            node.instance = new ftpd({cnf: config, hdl: handler})
            node.instance.on('log', msg => node.log(msg))
            node.instance.on('debug', msg => node.debug(msg))
            node.instance.on('listen', data => {
                node.state = State.Running
                node.broadcast('state', `listen on ${data.port}`)
            })
            node.instance.on('login', data => {
                console.log(data)
                node.broadcast('state', `user ${data.user} logged in. Sessions[${data.total}]`)
            })
            node.instance.on('logoff', data => node.broadcast('state', `user ${data.user} logged off. Sessions[${data.total}]`))
            node.state = State.Initialized
        }

        node.broadcast('state', node.state)
        if (!node.running) {
            node.instance.start()
            node.state = State.Starting
            node.broadcast('state', node.state)
        }

        this.on('close', function(done) {
            node.debug('jsftpd stopping')
            node.instance.stop()
            node.state = State.Stopping
            node.broadcast('state', node.state)
            node.running = false
            delete node.instance
            node.log('jsftpd instance stopped and deleted')
            done()
        });
    }
    RED.nodes.registerType('jsftpd-server', jsftpdServerNode, {
        credentials: {
            password: {type:"text"}
        }
    });
};
