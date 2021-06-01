const fetchLib = require('node-fetch');
const utils = require('./utils');

const DEFAULT_PORT = '8080';

module.exports = {
  status,
  tune,
};

function status(tuner) {
  return fetch(tuner, '/tv/getTuned')
    .then(res => res.json())
    .then((json) => {
      if ( json.minor && json.minor !== 65535 ) {
        json.channel = `${json.major}-${json.minor}`;
      } else {
        json.channel = json.major;
      }

      return json;
    });
}

function tune(tuner, channel) {
  let major = channel;
  let minor = 0;

  if ( channel.includes('.') ) {
    major = channel.split('.', 1)[0];
  } else if ( channel.includes('-') ) {
    [major, minor] = channel.split('-', 2);
  }

  let path = utils.addParam('/tv/tune', 'major', major);

  if ( minor ) {
    path = utils.addParam(path, 'minor', minor);
  }

  return fetch(tuner, path).then((res) => {
      // Get rid of banners, but don't make the caller wait for it
    utils.sleep(1000).then(() => {
      return fetch(tuner, '/remote/processKey?key=exit').then(() => {
        utils.sleep(1000).then(() => {
          return fetch(tuner, '/remote/processKey?key=exit').then(() => {
            utils.sleep(1000).then(() => {
              return fetch(tuner, '/remote/processKey?key=exit');
            });
          });
        });
      });
    });

    console.log(`[${tuner.name}] Tune to ${channel}: ${res.ok}`);
    return res.ok;
  });
}

function fetch(tuner, relative) {
  let url = `http://${tuner.dtvHost}:${tuner.dtvPort || DEFAULT_PORT}/` + relative.replace(/^\//, '');

  if ( tuner.dtvClient ) {
    url = utils.addParam(url, 'clientAddr', tuner.dtvClient);
  }

  return fetchLib(url);
}
