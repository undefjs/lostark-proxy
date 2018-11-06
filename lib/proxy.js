'use strict';

const net = require('net');
const EventEmitter = require('events');

class Proxy extends EventEmitter {
  constructor() {
    super();
  }
  createProxy(listenPort, listenHost, remotePort, remoteHost, onListen) {
    const server = net.createServer(s => {
      this.local = s;
      this.emit('connect', s);
      
      const client = this.remote = new net.Socket();
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

module.exports = Proxy;
