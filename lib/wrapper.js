'use strict';

const Proxy = require('./proxy');
const Parser = require('./parser');
const Protocol = require('./protocol');
const { fromServer, fromClient, toServer, toClient } = require('./packet');

class Wrapper {
  constructor(name, options, dispatch) {
    const { listenPort, listenHost = '127.0.0.1', remotePort, remoteHost } = options;
    this.name = name;
    this.dispatch = dispatch;
    this.setupProtocol();
    this.setupParsers(dispatch);
    this.setupProxy(listenPort, listenHost, remotePort, remoteHost);
  }
  dispatcher(isServer, packet) {
    if(packet.id === 1) return; //C_CHECK_VERSION
    if(packet.id === 2) { //S_CHECK_VERSION
      const obj = this.protocol.parse(undefined, 'S_CHECK_VERSION', '*', packet.data);
      const version = +obj.version.match(/\(CL:(\d+)\)/)[1];
      this.protocolVersion = version;
      console.log(`${proxyName} - automatically detected protocol version`, version);
    }
    
    const name = this.protocol.maps.get(this.protocolVersion).code[packet.id];
    if(!name) return console.log(`${proxyName} - missing definition<${packet.id}>`);
    
    const event = this.protocol.parse(this.protocolVersion, name, '*', packet.data);
    console.log(name, event);
    
    const ret = this.dispatch(name, event, isServer);
    if(ret) packet.data = this.protocol.write(this.protocolVersion, name, '*', event);
    return ret;
  }
  setupProtocol() {
    this.protocol = Protocol.createInstance();
    this.protocol.load('./data/');
  }
  setupParsers() {
    const localParser = this.localParser = new Parser();
    const remoteParser = this.remoteParser = new Parser();
    localParser.on('data', data => {
      //console.log(`${proxyName}-local - data`, data);
      const packet = fromClient(data);
      console.log(`${this.name}-local - packet`, packet);
      const ret = this.dispatcher(true, packet);
      if(ret) data = toServer(packet.data, packet.type, packet.id);
      if(ret !== false) this.proxy.remote.write(data);
    });
    remoteParser.on('data', data => {
      //console.log(`${proxyName}-remote - data`, data);
      const packet = fromServer(data);
      console.log(`${this.name}-remote - packet`, packet);
      const ret = this.dispatcher(true, packet);
      if(ret) data = toClient(packet.data, packet.type, packet.id);
      if(ret !== false) this.proxy.local.write(data);
    });
  }
  setupProxy(listenPort, listenHost, remotePort, remoteHost) {
    const proxyName = this.name;
    const proxy = this.proxy = new Proxy();
    proxy.on('connect', function() {
      console.log(`${proxyName} - client connected`);
    });
    proxy.on('rconnect', function() {
      console.log(`${proxyName} - server connected`);
    });
    proxy.on('data', function(data) {
      //console.log(`${proxyName} - data`, data);
      world2LocalParser.write(data);
    });
    proxy.on('rdata', function(data) {
      //console.log(`${proxyName} - rdata`, data);
      world2RemoteParser.write(data);
    });
    proxy.on('error', function(err) {
      console.log(`${proxyName} - client error`, err);
    });
    proxy.on('rerror', function(err) {
      console.log(`${proxyName} - server error`, err);
    });
    proxy.on('close', function() {
      console.log(`${proxyName} - client disconnected`);
    });
    proxy.on('rclose', function() {
      console.log(`${proxyName} - server disconnected`);
    });
    proxy.createProxy(listenPort, listenHost, remotePort, remoteHost, function() {
      console.log(`${proxyName} - listening`, this.address());
    });
  }
}

module.exports = Wrapper;
