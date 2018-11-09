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
  ':' + Config[`LOCAL_WORLD${which}_PORT`];

function loginCb(name, event) {
  switch (name) {
    case 'S_SERVER_LIST':
      for (const s of event.servers) {
        s.name += ' (Proxy)';
        s.len = s.name.length;
      }
      return true;
    case 'S_SELECT_WORLD':
      this.emit('S_SELECT_WORLD', [event.worldIP1, event.worldIP2]);
      event.worldIP1 = getLocalAddress(1);
      event.len1 = event.worldIP1.length;
      event.worldIP2 = getLocalAddress(2);
      event.len2 = event.worldIP2.length;
      return true;
  }
}

function world1Cb(name, event) {
  
}

function world2Cb(name, event) {
  
}

const worldCallbacks = [world1Cb, world2Cb];

function createWorldWrappers(remoteWorlds) {
  const worldWrappers = [];
  for (let i = 0, len = remoteWorlds.length; i < len; ) {
    const [host, port] = remoteWorlds[i].split(":");
    const cb = worldCallbacks[i++];
    worldWrappers.push(new Wrapper({
      name: 'World' + i, 
      options: {
        ...makeOpts('WORLD' + i),
        remoteHost: host,
        remotePort: port >>> 0,
      },
      dispatch: cb,
      isWorld: true
    }));
  }
}

const loginWrapper = new Wrapper({
  name: 'Login', 
  options: makeOpts('LOGIN'),
  dispatch: loginCb
});
loginWrapper.on('S_SELECT_WORLD', createWorldWrappers);
