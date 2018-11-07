'use strict';

const Proxy = require('./proxy');
const Parser = require('./parser');
const Protocol = require('./protocol');
const { makeDescriptor, inlineGlobals } = require('./global-provider');

class Wrapper {
  constructor(name, options, dispatch) {
    this.name = name;
    this.dispatch = dispatch;
    this.setupProtocol();
    this.setupParsers(dispatch);
    this.setupProxy(
      options.listenPort,
      options.listenHost || '127.0.0.1',
      options.remotePort,
      options.remoteHost
    );
  }
  dispatcher(isServer, packet) {
    const { id, data } = packet;
    switch (id) {
      case 1:   // C_CHECK_VERSION
        return;
      case 2: { // S_CHECK_VERSION
        const obj = this.protocol.parse(null, 'S_CHECK_VERSION', '*', data);
        const version = this._Number(obj.version.match(this.versionRegex)[1]);
        this.protocolVersion = version;
        this._console.log(
          '%s - automatically detected protocol version %d',
          this.name,
          version
        );
      }
    }

    const name = this.protocol.maps.get(this.protocolVersion).code[id];
    if (!name) {
      return this._console.log('%s - missing definition<%d>', this.name, id);
    }

    const event = this.protocol.parse(this.protocolVersion, name, '*', data);
    this._console.log(name, event);

    const ret = this.dispatch(name, event, isServer);
    if (ret) {
      packet.data = this.protocol.write(this.protocolVersion, name, '*', event);
    }
    return ret;
  }
  setupProtocol() {
    this.protocol = new this._Protocol;
    this.protocol.load('./data/');
  }
  setupParsers() {
    const localParser = this.localParser = new this._Parser;
    const remoteParser = this.remoteParser = new this._Parser;
    localParser.on('data', data => this.localParserData(data));
    remoteParser.on('data', data => this.remoteParserData(data));
  }
  localParserData(data) {
    // this._console.log('%s-local - data', this.name, data);
    const packet = this._packet.fromClient(data);
    this._console.log('%s-local - packet', this.name, packet);
    const ret = this.dispatcher(true, packet);
    if (ret) {
      data = this._packet.toServer(packet.data, packet.type, packet.id);
    }
    if (ret !== false) {
      this.proxy.remote.write(data);
    }
  }
  remoteParserData(data) {
    // this._console.log('%s-remote - data', data);
    const packet = this._packet.fromServer(data);
    this._console.log('%s-remote - packet', this.name, packet);
    const ret = this.dispatcher(true, packet);
    if (ret) {
      data = this._packet.toClient(packet.data, packet.type, packet.id);
    }
    if (ret !== false) {
      this.proxy.local.write(data);
    }
  }
  setupProxy(...args) {
    const proxy = this.proxy = new this._Proxy;
    proxy.name = this.name;
    proxy.localParser = this.localParser;
    proxy.remoteParser = this.remoteParser;
    const { proxyListeners } = this;
    for (const key in proxyListeners) {
      proxy.on(key, proxyListeners[key]);
    }
    proxy.createProxy(...args, this.onListen);
  }
}

const proxyListeners = {
  connect() { this._console.log('%s - client connected', this.name); },
  rconnect() { this._console.log('%s - server connected', this.name); },
  data(data) {
    // this._console.log('%s - data', this.name);
    this.localParser.write(data);
  },
  rdata(data) {
    // this._console.log('%s - data', this.name);
    this.remoteParser.write(data);
  },
  error(err) { this._console.log('%s - client error', this.name, err); },
  rerror(err) { this._console.log('%s - server error', this.name, err); },
  close() { this._console.log('%s - client disconnected', this.name); },
  rclose() { this._console.log('%s - server disconnected', this.name); },
  listen() {
    this._console.log('%s - listening', this.name, this.address());
  },
};

inlineGlobals(Wrapper);
Object.defineProperties(Wrapper.prototype, {
  versionRegex: makeDescriptor(/\(CL:(\d+)\)/),
  proxyListeners: makeDescriptor(proxyListeners),
  _Proxy: makeDescriptor(Proxy),
  _Parser: makeDescriptor(Parser),
  _Protocol: makeDescriptor(Protocol),
  _packet: makeDescriptor(require('./packet')),
});

module.exports = Wrapper;
