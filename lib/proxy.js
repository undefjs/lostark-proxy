'use strict';

const { makeDescriptor, inlineGlobals } = require('./global-provider');

class MakeServer {
  constructor(root, method) {
    this.root = root;
    this.method = method;
    this.result = null;
  }
  then(getServer) {
    this.result = this.root[this.method](getServer);
  }
}

class Proxy extends require('events') {
  async createProxy(listenPort, listenHost, remotePort, remoteHost, onListen) {
    const maker = new this._makeServer(this._net, "createServer");
    const connection = await maker;
    const server = maker.result;
    this.local = server;
    this.emit('connect', connection);

    const client = this.remote = new this._net.Socket;
    (
      client
      .connect(remotePort, remoteHost, () => this.emit('rconnect', client))
      .on('data', data => this.emit('rdata', data))
      .on('error', err => this.emit('rerror', err))
      .on('data', data => this.emit('rdata', data))
      .on('close', () => {
        this.emit('rclose');
        connection.destroy();
      })
    );

    (
      connection
      .on('data', data => this.emit('data', data))
      .on('error', err => this.emit('error', err))
      .on('close', () => {
        this.emit('close');
        client.destroy();
      })
    );

    server.listen(listenPort, listenHost, onListen);
  }
}

inlineGlobals(Proxy);
Object.defineProperties(Proxy.prototype, {
  _net: makeDescriptor(require('net')),
  _makeServer: makeDescriptor(MakeServer),
});

module.exports = Proxy;
