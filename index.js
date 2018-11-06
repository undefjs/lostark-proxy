'use strict';

const Config = require('./config');
const Wrapper = require('./lib/wrapper');

const loginWrapper = new Wrapper('Login-Proxy', {
  listenPort: Config.LOCAL_LOGIN_PORT,
  listenHost: Config.LOCAL_LOGIN_HOST,
  remotePort: Config.REMOTE_LOGIN_PORT,
  remoteHost: Config.REMOTE_LOGIN_HOST
}, function(name, event) {
  
  if(name === 'S_SERVER_LIST') {
    for(let s of event.servers) {
      s.name += '(Proxy)';
    }
    return true;
  }
  else if(name === 'S_SELECT_WORLD') {
    //TODO: set world remote ip
    event.worldIP1 = `${Config.LOCAL_WORLD1_HOST}:${Config.LOCAL_WORLD1_PORT}`;
    event.worldIP2 = `${Config.LOCAL_WORLD2_HOST}:${Config.LOCAL_WORLD2_PORT}`;
    return true;
  }
  
});

const world1Wrapper = new Wrapper('World1-Proxy', {
  listenPort: Config.LOCAL_WORLD1_PORT,
  listenHost: Config.LOCAL_WORLD1_HOST,
  remotePort: Config.REMOTE_WORLD1_PORT,
  remoteHost: Config.REMOTE_WORLD1_HOST
}, function(name, event) {
  
});

const world2Wrapper = new Wrapper('World2-Proxy', {
  listenPort: Config.LOCAL_WORLD2_PORT,
  listenHost: Config.LOCAL_WORLD2_HOST,
  remotePort: Config.REMOTE_WORLD2_PORT,
  remoteHost: Config.REMOTE_WORLD2_HOST
}, function(name, event) {
  
});
