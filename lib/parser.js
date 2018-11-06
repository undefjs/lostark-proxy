'use strict';

const EventEmitter = require('events');

class Parser extends EventEmitter {
  constructor() {
    super();
    this.buffer = Buffer.allocUnsafe(0);
  }
  write(data) {
    let buf = this.buffer = Buffer.concat([this.buffer, data]);
    
    do {
      if(buf.length < 2) return console.log('packet bad length', buf);
      
      const len = buf.readUInt16LE(0);
      if(len > buf.length) return console.log('packet truncated bytes', buf);
      
      const packet = Buffer.from(buf.slice(0, len));
      buf = this.buffer = buf.slice(len);
      
      this.emit('data', packet);
    }
    while(buf.length);
  }
}

module.exports = Parser;
