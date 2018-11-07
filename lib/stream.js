'use strict';

const { inlineGlobals, makeDescriptor } = require('./global-provider');

class Readable {
  constructor(buffer, position = 0) {
    this.buffer = buffer;
    this.position = position;
  }

  seek(n) { return this.position = n; }
  skip(n) { return this.position += n; }

  bool() {
    const ret = this.byte();
    if (ret > 1) {
      this._console.error(new this._Error('read byte not 0 or 1 for bool'));
    }
    return ret > 0;
  }

  byte() { return this.buffer.readUInt8(this.position++); }

  bytes(n) {
    return this._Buffer.from(
      this.buffer.slice(this.position, this.position += n)
    );
  }

  uint16() {
    const ret = this.buffer.readUInt16LE(this.position);
    this.position += 2;
    return ret;
  }

  uint32() {
    const ret = this.buffer.readUInt32LE(this.position);
    this.position += 4;
    return ret;
  }

  uint64() {
    return this._BigInt.asUintN(
      64,
      this._BigInt(this.uint32()) | (this._BigInt(this.uint32()) << 32n)
    );
  }

  int16() {
    const ret = this.buffer.readInt16LE(this.position);
    this.position += 2;
    return ret;
  }

  int32() {
    const ret = this.buffer.readInt32LE(this.position);
    this.position += 4;
    return ret;
  }

  int64() {
    return this._BigInt.asIntN(
      64,
      this._BigInt(this.uint32()) | (this._BigInt(this.uint32()) << 32n)
    );
  }

  float() {
    const ret = this.buffer.readFloatLE(this.position);
    this.position += 4;
    return ret;
  }

  double() {
    const ret = this.buffer.readDoubleLE(this.position);
    this.position += 8;
    return ret;
  }

  string() {
    const ret = [];
    for (let c = 0, i = -1; c = this.uint16(); ) ret[++i] = c;
    return this._String.fromCharCode.apply(null, ret);
  }
}

inlineGlobals(Readable);

class Writable {
  constructor(length) {
    this.buffer = this._Buffer.alloc(this.length = length);
    this.position = 0;
  }

  seek(n) { this.position = n; }
  skip(n) { this.position += n; }

  bool(b) { this.buffer[this.position++] = !!b; }

  byte(n) { this.buffer[this.position++] = n; }

  bytes(buf) {
    if (!buf) return;
    buf.copy(this.buffer, this.position);
    this.position += buf.length;
  }

  uint16(n = 0) {
    this.position = this.buffer.writeUInt16LE(n & 0xFFFF, this.position);
  }

  uint32(n = 0) {
    this.position = this.buffer.writeUInt32LE(n >>> 0, this.position);
  }

  uint64(n = 0n) {
    if (typeof n !== 'bigint') n = this._BigInt.asUintN(64, n);
    this.uint32(this._Number(n & 0xFFFFFFFFn));
    this.uint32(this._Number(n >> 32n & 0xFFFFFFFFn));
  }

  float(n = 0) { this.position = this.buffer.writeFloatLE(n, this.position); }

  double(n = 0) { this.position = this.buffer.writeDoubleLE(n, this.position); }

  string(str = '') {
    this.buffer.fill(
      str + '\0',
      this.position,
      this.position += (str.length + 1) * 2,
      'ucs2'
    );
  }
}

inlineGlobals(Writable);

Object.defineProperties(Writable.prototype, {
  int16: makeDescriptor(Writable.prototype.uint16),
  int32: makeDescriptor(Writable.prototype.uint32),
  int64: makeDescriptor(Writable.prototype.uint64),
});

module.exports = {
  Readable,
  Writable
};
