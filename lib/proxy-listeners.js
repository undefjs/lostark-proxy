'use strict';

// Context: Proxy
const remoteListeners = {
  rconnect() {
    this._console.log('%s - server connected', this.name);
  },
  rdata(data) {
    // this._console.log('%s - data', this.name);
    this.remoteParser.write(data);
  },
  rerror(err) {
    this._console.log('%s - server error', this.name, err);
  },
  rclose() {
    this._console.log('%s - server disconnected', this.name);
  },
};

// Context: Proxy
const localListeners = {
  connect() {
    this._console.log('%s - client connected', this.name);
  },
  data(data) {
    // this._console.log('%s - data', this.name);
    this.localParser.write(data);
  },
  error(err) {
    this._console.log('%s - client error', this.name, err);
  },
  close() {
    this._console.log('%s - client disconnected', this.name);
  },
};

const proxyListeners = {
  ...localListeners,
  ...remoteListeners,
  // Context: net.Socket + _proxyName property
  listen() {
    const { address, port } = this.address();
    console.log('%s - listening', this._proxyName, { address, port });
  },
};

module.exports = proxyListeners;
