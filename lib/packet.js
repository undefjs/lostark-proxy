'use strict';

function indexOf(source, search) {
  const len1 = source.length;
  const len2 = search.length;
  if (!len1 || !len2) return -1;
  for (let i = 0, counter = 0; i < len1; ++i) {
    if (source[i] !== search[counter]) {
      counter = 0;
    }
    else if (++counter >= len2) {
      return 1 + i - counter;
    }
  }
  return -1;
}

function parseHeader(buf) {
  return {
    len: buf.readUInt16LE(0),
    id: buf.readUInt16LE(2),
    unk1: buf.readUInt8(4), // 0
    type: buf.readUInt8(5)  // 0 = plain, 1 = xor, 2 = unk
  }
}

function fromServer(buf) {
  const header = parseHeader(buf);
  const data = this._Buffer.from(buf.slice(6));
  const packet = {
    ...header,
    data
  };

  if (packet.type !== 1) return packet;

  const { xorTable } = this;
  const counter = buf.readUInt8(2);
  const len = data.length;
  for (let i = 0; i < len; ++i) {
    data[i] ^= xorTable[i + counter & 0xFF];
  }

  return packet;
}

function fromClient(buf) {
  const header = parseHeader(buf);
  const data = this._Buffer.from(buf.slice(6));
  const packet = {
    ...header,
    data
  };

  if (packet.type !== 1) return packet;

  const { xorTable } = this;
  const counter = indexOf(xorTable, data.slice(4, 8)) - 4;
  this._console.log('- guessedCounter', counter);

  const len = data.length;
  for (let i = 0; i < len; ++i) {
    data[i] ^= xorTable[i + counter & 0xFF];
  }

  return packet;
}

function toServer(data, type = 1, id = 0) {
  const len = data.length;
  const packetLen = len + 6;
  const buf = this._Buffer.allocUnsafe(packetLen);
  buf.writeUInt16LE(packetLen, 0);
  buf.writeUInt16LE(id, 2);
  buf.writeUInt8(0x00, 4); //unk1
  buf.writeUInt8(type, 5);

  const counter = data.readUInt32LE(0);

  if (type === 1) {
    const { xorTable } = this;
    for (let i = 0, k = 5; i < len; ++i) {
      buf[++k] = data[i] ^ xorTable[i + counter & 0xFF];
    }
  }
  else {
    for (let i = 0, k = 5; i < len; ++i) {
      buf[++k] = data[i];
    }
  }

  return buf;
}

function toClient(data, type = 1, id = 0) {
  const len = data.length;
  const packetLen = len + 6;
  const buf = this._Buffer.allocUnsafe(packetLen);
  buf.writeUInt16LE(packetLen, 0);
  buf.writeUInt16LE(id, 2);
  buf.writeUInt8(0x00, 4); //unk1
  buf.writeUInt8(type, 5);

  const counter = id & 0xFF;

  if (type === 1) {
    const { xorTable } = this;
    for (let i = 0, k = 5; i < len; ++i) {
      buf[++k] = data[i] ^ xorTable[i + counter & 0xFF];
    }
  }
  else {
    for (let i = 0, k = 5; i < len; ++i) {
      buf[++k] = data[i];
    }
  }

  return buf;
}

function init(version) {
  if (this._loaded) return;
  const xor = this._path.join(this._cwd, '..', 'data', 'xor', version + '.xor');
  if (!this._fs.existsSync(xor)) {
    this._console.error('Could not find xor table %d', version);
    process.exit(1);
  }
  this.xorTable = this._fs.readFileSync(xor);
  this._loaded = true;
}

module.exports = {
  counterHighBytes: [0, 0, 0, 0, 0, 0, 0],
  fromServer,
  fromClient,
  toServer,
  toClient,
  xorTable: null,
  indexOf,
  init,
  _loaded: false,
  _Buffer: Buffer,
  _console: console,
  _fs: require('fs'),
  _path: require('path'),
  _cwd: __dirname
};
