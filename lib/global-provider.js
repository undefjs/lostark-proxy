'use strict';

function makeDescriptor(value) {
  return { value, writable: true, configurable: true };
}

const globals = {
  _Array: makeDescriptor(Array),
  _BigInt: makeDescriptor(BigInt),
  _Object: makeDescriptor(Object),
  _Reflect: makeDescriptor(Reflect),
  _Number: makeDescriptor(Number),
  _Buffer: makeDescriptor(Buffer),
  _console: makeDescriptor(console),
  _Error: makeDescriptor(Error),
  _TypeError: makeDescriptor(TypeError),
};

function extend(ctor) {
  Object.defineProperties(ctor.prototype, globals);
}

exports.makeDescriptor = makeDescriptor;
exports.inlineGlobals = extend;