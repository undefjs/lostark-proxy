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

function loginCb(name, event) {
  /*if (name === 'S_SERVER_LIST') {
    for (const s of event.servers) {
      s.name += ' (Proxy)';
    }
    return true;
  }
  else if (name === 'S_SELECT_WORLD') {
    //TODO: set world remote ip
    event.worldIP1 = `${Config.LOCAL_WORLD1_HOST}:${Config.LOCAL_WORLD1_PORT}`;
    event.worldIP2 = `${Config.LOCAL_WORLD2_HOST}:${Config.LOCAL_WORLD2_PORT}`;
    return true;
  }*/
}

function world1Cb(name, event) {
  
}

function world2Cb(name, event) {
  
}

const loginWrapper = new Wrapper('Login-Proxy', makeOpts("LOGIN"), loginCb);
const world1Wrapper = new Wrapper('World1-Proxy', makeOpts("WORLD1"), world1Cb);
const world2Wrapper = new Wrapper('World2-Proxy', makeOpts("WORLD2"), world2Cb);
