'use strict';

class Parser extends require('events') {
  constructor() {
    super();
    this.buffer = this._Buffer.allocUnsafe(0);
  }
  write(data) {
    let buf = this.buffer = this._Buffer.concat([this.buffer, data]);
    
    do {
      const length = buf.length;
      if (length < 2) return this._console.log('packet bad length', buf);
      
      const len = buf.readUInt16LE(0);
      if (len > length) return this._console.log('packet truncated bytes', buf);
      
      const packet = this._Buffer.from(buf.slice(0, len));
      buf = this.buffer = buf.slice(len);
      
      this.emit('data', packet);
    }
    while (buf.length);
  }
}

require('./global-provider').inlineGlobals(Parser);

module.exports = Parser;
