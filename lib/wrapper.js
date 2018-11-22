'use strict';

const fs = require('fs');
const Proxy = require('./proxy');
const Parser = require('./parser');
const stream = require('./stream');
const Protocol = require('./protocol');
const packetUtils = require('./packet');
const proxyListeners = require('./proxy-listeners');
const { makeDescriptor, inlineGlobals } = require('./global-provider');

class Wrapper extends require('events') {
  constructor({ name, options, dispatch, isWorld = false }) {
    super();
    this.worldWrappersStarted = false;
    this.name = name + '-Proxy';
    this.dispatch = dispatch;
    this.setupProtocol();
    this.setupParsers();
    this.setupProxy(
      [options.listenPort, options.listenHost || '127.0.0.1'],
      [options.remotePort, options.remoteHost]
    );
    if (isWorld) {
      this.proxy.once('cleanup', () => this.destroyProxy());
    }
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
  setupProxy(localOpts, remoteOpts) {
    const proxy = this.proxy = new this._Proxy(this);
    const { proxyListeners } = this;
    for (const key in proxyListeners) {
      if (key === 'listen') continue;
      proxy.on(key, proxyListeners[key]);
    }
    localOpts.push(proxyListeners.listen);
    proxy.createProxy(localOpts, remoteOpts);
  }
  destroyProxy() {
    this.removeAllListeners();
    this.proxy.removeAllListeners();
    this.localParser.removeAllListeners();
    this.remoteParser.removeAllListeners();
  }
  dispatcher(isServer, packet) {
    const { id, data } = packet;
    switch (id) {
      case 1:   // C_CHECK_VERSION
        return;
      case 2: { // S_CHECK_VERSION
        const reader = new this._stream.Readable(data, 22);
        const str = reader.string();
        const version = this._Number(str.match(this.versionRegex)[1]);
        Wrapper.protocolVersion = version;
        // FIXME have to hardcode version, xortable version doesn't match
        this._packet.init(647739);
        this._console.log(
          '%s - automatically detected protocol version %d',
          this.name,
          version
        );
      }
    }

    const { protocolVersion } = Wrapper;
    const map = this.protocol.maps.get(protocolVersion);
    if (!map) {
      return this._console.log(
        '%s - missing protocol version<%d>',
        this.name,
        protocolVersion
      );
    }

    const name = map.code.get(id);
    if (!name) {
      return this._console.log('%s - missing opcode<%d>', this.name, id);
    }

    const event = this.protocol.parse(protocolVersion, name, '*', data);
    this._console.log(name, event);

    const ret = this.dispatch(name, event, isServer);
    if (ret) {
      packet.data = this.protocol.write(protocolVersion, name, '*', event);
    }
    return ret;
  }
  localParserData(data) {
    const packet = this._packet.fromClient(data);
    this._console.log('%s - client packet', this.name, data.toString('hex'));
    this._console.log(packet.id, packet.data.toString('hex'));
    this._fs.writeFileSync(`./log/${this.name}.log`, `${packet.id} client ${packet.data.toString('hex')}\n`, {flag: 'a'});
    const ret = this.dispatcher(false, packet);
    if (ret) {
      data = this._packet.toServer(packet.data, packet.type, packet.id);
    }
    if (ret !== false) {
      this.proxy.remote.write(data);
    }
  }
  remoteParserData(data) {
    const packet = this._packet.fromServer(data);
    this._console.log('%s - server packet', this.name, data.toString('hex'));
    this._console.log(packet.id, packet.data.toString('hex'));
    this._fs.writeFileSync(`./log/${this.name}.log`, `${packet.id} server ${packet.data.toString('hex')}\n`, {flag: 'a'});
    const ret = this.dispatcher(true, packet);
    if (ret) {
      this._console.log(packet.id, packet.data.toString('hex'));
      data = this._packet.toClient(packet.data, packet.type, packet.id);
    }
    if (ret !== false) {
      this.proxy.local.write(data);
    }
  }
}

inlineGlobals(Wrapper);
Object.defineProperties(Wrapper.prototype, {
  versionRegex: makeDescriptor(/\(CL:(\d+)\)/),
  proxyListeners: makeDescriptor(proxyListeners),
  _fs: makeDescriptor(fs),
  _Proxy: makeDescriptor(Proxy),
  _stream: makeDescriptor(stream),
  _Parser: makeDescriptor(Parser),
  _Protocol: makeDescriptor(Protocol),
  _packet: makeDescriptor(packetUtils),
});

module.exports = Wrapper;
