module.exports = RED => {
    function uploadHandler(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.server = RED.nodes.getNode(n.server);
        node.server.subscribe(node.id, 'state', state => node.status(state));
        node.server.subscribe(node.id, 'upload', evt => node.send({ payload: evt.data }));
    }
    RED.nodes.registerType('jsftpd-upload', uploadHandler);
}
