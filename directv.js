const fetchLib = require('node-fetch');

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

  if ( channel.includes('-') ) {
    [major, minor] = channel.split('-', 2);
  }

  let path = addParam('/tv/tune', 'major', major);

  if ( minor ) {
    path = addParam(path, 'minor', minor);
  }

  return fetch(tuner, path).then((res) => {
    console.log(`Tune ${tuner.name} to ${channel}: ${res.ok}`);
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
