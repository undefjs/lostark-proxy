'use strict';

const { makeDescriptor, inlineGlobals } = require('./global-provider');

class Proxy extends require('events') {
  constructor(wrapper) {
    super();
    const { name, localParser, remoteParser } = wrapper;
    this._Object.assign(this, { name, localParser, remoteParser });
  }
  handleConnection(connection, remoteOpts) {
    this.emit('connect', connection);

    const client = (
      (this.remote = new this._net.Socket)
      .connect(...remoteOpts, () => this.emit('rconnect', client))
      .on('data', data => this.emit('rdata', data))
      .on('error', err => this.emit('rerror', err))
      .on('close', () => {
        this.emit('rclose');
        this.destroy();
      })
    );
    (
      (this.local = connection)
      .on('data', data => this.emit('data', data))
      .on('error', err => this.emit('error', err))
      .on('close', () => {
        this.emit('close');
        this.destroy();
      })
    );
  }
  createProxy(localOpts, remoteOpts) {
    const server = this._net.createServer(
      c => this.handleConnection(c, remoteOpts)
    );
    server._proxyName = this.name;
    server.listen(...localOpts);
  }
  destroy() {
    this.local = void this.local.removeAllListeners().destroy().unref();
    this.remote = void this.remote.removeAllListeners().destroy().unref();
  }
}

inlineGlobals(Proxy);
Object.defineProperties(Proxy.prototype, {
  _net: makeDescriptor(require('net')),
});

module.exports = Proxy;
