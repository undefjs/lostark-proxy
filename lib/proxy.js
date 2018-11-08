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
  createProxy(listenPort, listenHost, remotePort, remoteHost, onListen) {
    const server = this._net.createServer(s => {
      this.local = s;
      this.emit('connect', s);
      
      const client = this.remote = new this._net.Socket();
      client.connect(remotePort, remoteHost, () => {
        this.emit('rconnect', client);
      });
      client.on('data', data => {
        this.emit('rdata', data);
      });
      client.on('error', err => {
        this.emit('rerror', err);
      });
      client.on('close', () => {
        this.emit('rclose');
        s.destroy();
      });
       s.on('data', data => {
        this.emit('data', data);
      });
      s.on('error', err => {
        this.emit('error', err);
      });
      s.on('close', () => {
        this.emit('close');
        client.destroy();
      });
    });
    
    server.listen(listenPort, listenHost, onListen);
  }
}

inlineGlobals(Proxy);
Object.defineProperties(Proxy.prototype, {
  _net: makeDescriptor(require('net')),
  _makeServer: makeDescriptor(MakeServer),
});

module.exports = Proxy;
