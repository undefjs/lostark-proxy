'use strict';

const Config = require('./config');
const Wrapper = require('./lib/wrapper');

function makeOpts(name) {
  return {
    listenPort: Config[`LOCAL_${name}_PORT`],
    listenHost: Config[`LOCAL_${name}_HOST`],
    remotePort: Config[`REMOTE_${name}_PORT`],
    remoteHost: Config[`REMOTE_${name}_HOST`],
  };
}

const getLocalAddress = which => Config[`LOCAL_WORLD${which}_HOST`] +
  ":" + Config[`LOCAL_WORLD${which}_PORT`];

function loginCb(name, event) {
  switch (name) {
    case 'S_SERVER_LIST':
      for (const s of event.servers) {
        s.name += '(Proxy)';
      }
      return true;
    case 'S_SELECT_WORLD':
      this.emit('S_SELECT_WORLD');
      event.worldIP1 = getLocalAddress(1);
      event.worldIP2 = getLocalAddress(2);
      return true;
  }
}

function world1Cb(name, event) {
  
}

function world2Cb(name, event) {
  
}

function createWorldWrappers() {
  const world1Wrapper = new Wrapper({
    name: 'World1', 
    options: makeOpts('WORLD1'),
    dispatch: world1Cb,
    isWorld: true
  });
  const world2Wrapper = new Wrapper({
    name: 'World2', 
    options: makeOpts('WORLD2'),
    dispatch: world2Cb,
    isWorld: true
  });
}

const loginWrapper = new Wrapper({
  name: 'Login', 
  options: makeOpts('LOGIN'),
  dispatch: loginCb
});
loginWrapper.on('S_SELECT_WORLD', createWorldWrappers);
