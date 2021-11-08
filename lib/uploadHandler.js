module.exports = RED => {
    function uploadHandler(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        node.server = RED.nodes.getNode(n.server);
        node.nodemailer = n.nodemailer || true;
        node.server.subscribe(node.id, 'state', state => node.status(state));
        node.server.subscribe(node.id, 'upload', evt => {
            if (node.nodemailer) {
                node.send({ payload: [{ filename: evt.data.filename, content: evt.data.content }] });
            } else {
                node.send({ payload: evt.data });
            }
        });
    }
    RED.nodes.registerType('jsftpd-upload', uploadHandler);
}
