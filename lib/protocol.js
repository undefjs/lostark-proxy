'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const Stream = require('./stream');
const defParser = require('./parsers/def');
const mapParser = require('./parsers/map');
const { makeDescriptor, inlineGlobals } = require('./global-provider');

const PATH_MAPS = 'map';
const PATH_DEFS = 'protocol';
const SIZES = {
  bool: 1,
  byte: 1,

  int16: 2,
  uint16: 2,
  count: 2,
  offset: 2,

  int32: 4,
  uint32: 4,
  float: 4,

  int64: 8,
  uint64: 8,
  double: 8
};

class Protocol {
  constructor() {
    this.maps = new Map;
    this.messages = new Map;
    this.loaded = false;
  }

  /**
   * Given an identifier, retrieve the name, opcode, and definition object.
   * @private
   * @param {Number} protocolVersion
   * @param {String|Number|Object} identifier
   * @param {Number} [definitionVersion]
   * @param {String} [defaultName] Default name to return if `identifier` is an
   * object, since no lookups will be performed.
   * @returns {Object} An object with the `definition` property set, plus a
   * `name` and `code` if either a name or an opcode was passed in as the
   * identifier.
   * @throws {TypeError} `identifier` must be one of the listed types.
   * @throws {Error} if supplied an opcode that could not be mapped to a `name`.
   * @throws {Error} if a `definition` cannot be found.
   */
  resolveIdentifier(protocolVersion, identifier, definitionVersion = '*', defaultName = '<Object>') {
    const { maps, messages, loaded } = this;

    if (!loaded) this.load();

    if (this._Array.isArray(identifier)) {
      return {
        name: defaultName,
        code: null,
        version: '?',
        definition: identifier
      };
    }

    const map = maps.get(protocolVersion);
    if (!map) {
      throw new this._Error(
        `no mapping for protocol version ${protocolVersion}`
      );
    }

    let name;
    let code;
    let version;
    let definition;

    switch (typeof identifier) {
      case 'string': {
        name = identifier;
        if (map.name.has(name)) {
          code = map.name.get(name);
        }
        else {
          const err = new this._Error(`code not known for message "${name}"`);
          this._console.warn(err);
          code = null;
        }
        break;
      }
      case 'number': {
        code = identifier;
        if (map.code.has(code)) {
          name = map.code.get(code);
        }
        else {
          throw new this._Error(`mapping not found for opcode ${code}`);
        }
        break;
      }
      default: {
        throw new this._TypeError('identifier must be a string or number');
      }
    }

    const versions = messages.get(name);
    if (versions) {
      version = definitionVersion === '*' ?
        this._Math.max(...versions.keys()) :
        definitionVersion;

      definition = versions.get(version);
    }

    if (!definition) {
      throw new this._Error(this._util.format(
        'no definition found for message (name: "%s", code: %s, version: %s)',
        name,
        code,
        version
      ));
    }

    return { name, code, version, definition };
  }

  /**
   * Given a definition object and a data object, efficiently compute the byte
   * length for the resulting data buffer.
   * @private
   * @param {Object} definition
   * @param {Object} data
   * @returns {Number}
   * @throws Errors if a type specified in the `definition` is not recognized.
   */
  getLength(definition, data = {}) {
    let length = 0;
    const { isArray } = this._Array;

    for (const [key, type] of definition) {
      const val = data[key];
      if (isArray(type)) {
        switch (type.type) {
          case 'array': {
            if (isArray(val)) {
              for (const elem of val) {
                // here + next offsets + recurisve length
                length += this.getLength(type, elem);
              }
            }
            break;
          }
          case 'object': {
            length += this.getLength(type, val);
            break;
          }
          default: {
            // TODO warn/throw?
            break;
          }
        }
      }
      else {
        switch (type) {
          case 'bytes': {
            if (val) length += val.length;
            break;
          }
          case 'string': {
            // utf+16 + null byte
            length += ((val || '').length + 1) * 2;
            break;
          }
          default: {
            const size = this.SIZES[type];
            if (size) {
              length += size;
            }
            else {
              throw new this._Error(`unknown type: ${type}`);
            }
            break;
          }
        }
      }
    }

    return length;
  }

  // public methods
  /**
   * Loads (or reloads) the opcode mapping and message definitions.
   * @param {String} [basePath] Path to the base package.json.
   */
  load(basePath = '../') {
    const { maps, messages } = this;
    const { basename, join } = this._path;

    const mappedMessages = new Set;

    // reset maps and messages
    maps.clear();
    messages.clear();

    // read map
    const mapPath = join(basePath, this.PATH_MAPS);
    const mapFiles = this._fs.readdirSync(mapPath);
    for (const file of mapFiles) {
      const fullpath = join(mapPath, file);

      const parsedName = basename(file).match(this.protocolRegex);
      if (!parsedName) {
        if (file.startsWith('protocol.') && file.endsWith('.map')) {
          this._console.warn(
            '[protocol] load (map) - invalid filename syntax "%s"',
            fullpath
          );
        }
        else {
          this._console.debug(
            '[protocol] load (map) - skipping path "%s"',
            fullpath
          );
        }
        continue;
      }

      const version = parseInt(parsedName[1], 10);
      const mapping = this._mapParser(fullpath);
      if (!mapping) continue;

      maps.set(version, mapping);

      for (const name of mapping.name.keys()) {
        mappedMessages.add(name);
      }
    }

    // read protocol directory
    const defPath = join(basePath, this.PATH_DEFS);
    const defFiles = this._fs.readdirSync(defPath);
    for (const file of defFiles) {
      const fullpath = join(defPath, file);

      const parsedName = basename(file).match(this.defRegex);
      if (!parsedName) {
        if (file.endsWith('.def')) {
          this._console.warn(
            '[protocol] load (def) - invalid filename syntax "%s"',
            fullpath);
        }
        else {
          this._console.debug(
            '[protocol] load (def) - skipping path "%s"',
            fullpath
          );
        }
        continue;
      }

      const name = parsedName[1];
      const version = parseInt(parsedName[2], 10);

      const definition = this._defParser(fullpath);
      if (!definition) continue;

      if (!messages.has(name)) messages.set(name, new Map);
      messages.get(name).set(version, definition);

      if (!mappedMessages.has(name)) {
        this._console.warn('[protocol] load - unmapped message "%s"', name);
      }
    }

    return this.loaded = true;
  }

  /**
   * @param {Number} protocolVersion
   * @param {String|Number|Object} identifier
   * @param {Number} [definitionVersion]
   * @param {Buffer|Stream.Readable} [reader]
   * @param {String} [customName]
   * @returns {Object}
   */
  parse(protocolVersion, identifier, definitionVersion, reader, customName) {
    const { _Buffer: isBuffer, _Array: isArray } = this;
    // parse params
    if (isBuffer(definitionVersion)) {
      reader = definitionVersion;
      definitionVersion = '*';
    }

    const { name, version, definition } = this.resolveIdentifier(
      protocolVersion, identifier, definitionVersion, customName
    );
    const displayName = version !== '?' ? `${name}<${version}>` : name;

    // convert `reader` to a stream
    if (isBuffer(reader)) {
      reader = new this._Stream.Readable(reader, 6);
    }

    // begin parsing
    const count = new Map;
    const offset = new Map;

    const parseField = ([key, type], data, keyPathBase = '') => {
      const keyPath = keyPathBase !== '' ? `${keyPathBase}.${key}` : key;

      if (isArray(type)) {
        if (type.type === 'object') {
          data[key] = {};
          for (const f of type) {
            parseField(f, data[key], keyPath);
          }
          return;
        }

        // handle array type
        const length = count.get(keyPath);
        const array = [];
        let index = 0;

        while (index <= length) {
          array[index++] = this.parse(null, type, null, reader, `${displayName}.${keyPath}`);
        }

        data[key] = array;
      }
      else {
        // handle primitive type
        switch (type) {
          case 'count': {
            count.set(keyPath, reader.uint16());
            break;
          }

          case 'offset': {
            offset.set(keyPath, reader.uint16());
            break;
          }

          default: {
            let cnt = count.get(keyPath);
            if (offset.has(keyPath)) {
              const ofs = offset.get(keyPath);
              // check if offset lies within header
              if ((type !== 'bytes' || cnt > 0) && ofs < (2 + offset.size + count.size) * 2) {
                throw new this._Error(`${displayName}.${keyPath}: invalid offset for "${keyPath}" at ${reader.position} (inside header)`);
              }
              if (reader.position !== ofs) {
                this._console.warn(`[protocol] parse - ${displayName}: offset mismatch for "${keyPath}" at ${reader.position} (expected ${ofs})`);
                reader.seek(ofs);
              }
            }

            data[key] = reader[type](cnt);
            break;
          }
        }
      }
    };

    const data = {};
    for (const field of definition) {
      parseField(field, data, []);
    }
    return data;
  }

  /**
   * @param {Number} protocolVersion
   * @param {String|Number|Object} identifier
   * @param {Number} [definitionVersion]
   * @param {Object} data
   * @param {Stream.Writeable} [writer]
   * @param {String} [customName]
   * @returns {Buffer}
   */
  write(protocolVersion, identifier, definitionVersion, data, writer, customName, customCode) {
    // parse args
    if (typeof definitionVersion === 'object') {
      data = definitionVersion;
      definitionVersion = '*';
    }

    if (!definitionVersion) definitionVersion = '*';
    if (!data) data = {};

    let { name, code, version, definition } = this.resolveIdentifier(
      protocolVersion, identifier, definitionVersion, customName
    );

    code = code || customCode;

    const displayName = version !== '?' ? `${name}<${version}>` : name;

    // set up optional arg `writer`
    if (!writer) {
      // make sure `code` is valid
      if (code == null || code < 0) {
        throw new this._Error(`[protocol] write ("${name}"): invalid code "${code}"`);
      }

      // set up stream
      const length = 6 + this.getLength(definition, data);
      console.log(length.toString(16), definition, data);
      writer = new this._Stream.Writable(length);
      writer.uint16(length);
      writer.uint16(code);
      writer.byte(0);
      writer.byte(1);
    }

    // begin writing
    const count = new Map;
    const offset = new Map;

    const writeField = ([key, type], dataObj, keyPathBase = '') => {
      const value = dataObj[key];
      const keyPath = keyPathBase !== '' ? `${keyPathBase}.${key}` : key;

      // `type` is array or object
      if (Array.isArray(type)) {
        if (type.type === 'object') {
          for (const field of type) {
            writeField(field, value || {}, keyPath);
          }
          return;
        }

        if (!value) return;

        const length = value.length;
        if (length !== 0) {
          // write length in header
          const here = writer.position;
          writer.seek(count.get(keyPath));
          writer.uint16(length - 1);
          writer.seek(here);

          // iterate elements
          //let last = offset.get(keyPath)
          for (const element of value) {
            // write position in last element (or header)
            //const hereElem = writer.position
            //writer.seek(last)
            //writer.uint16(hereElem)
            //writer.seek(hereElem)

            // write position in current element
            //writer.uint16(hereElem)

            // store position pointing to next element
            //last = writer.position

            // write placeholder position
            //writer.uint16(0)

            // recurse
            this.write(null, type, version, element, writer, `${displayName}.${keyPath}`);
          }
        }
      // `type` is primitive
      }
      else {
        switch (type) {
          // save position and write placeholders for count and offset
          case 'count': {
            count.set(keyPath, writer.position);
            writer.uint16(0);
            break;
          }

          case 'offset': {
            offset.set(keyPath, writer.position);
            writer.uint16(0);
            break;
          }

          // otherwise,
          default: {
            // update count
            if (count.has(keyPath) && value) {
              const here = writer.position;
              writer.seek(count.get(keyPath));
              writer.uint16(value.length);
              writer.seek(here);
            }

            // update offset
            if (offset.has(keyPath)) {
              const here = writer.position;
              writer.seek(offset.get(keyPath));
              writer.uint16(here);
              writer.seek(here);
            }

            // write it
            try {
              //console.log(type, value)
              writer[type](value);
            } catch (err) {
              err.message = this._util.format(
                '[protocol] write - %s: error writing "%s" (type: %s)\ndata: %o\nreason: %s',
                displayName,
                keyPath,
                type,
                this._util.inspect(value),
                err.message
              );
              throw err;
            }
          }
        }
      }
    };

    for (const field of definition) {
      writeField(field, data);
    }

    return writer.buffer;
  }
}

inlineGlobals(Protocol);
Object.defineProperties(Protocol.prototype, {
  _fs: makeDescriptor(fs),
  _path: makeDescriptor(path),
  _util: makeDescriptor(util),
  _Stream: makeDescriptor(Stream),
  _defParser: makeDescriptor(defParser),
  _mapParser: makeDescriptor(mapParser),
  protocolRegex: makeDescriptor(/^protocol.(\d+)\.map$/),
  defRegex: makeDescriptor(/^(\w+)\.(\d+)\.def$/),
  PATH_MAPS: makeDescriptor(PATH_MAPS),
  PATH_DEFS: makeDescriptor(PATH_DEFS),
  SIZES: makeDescriptor(SIZES),
});

module.exports = Protocol;
