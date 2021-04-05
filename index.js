#!/usr/bin/env node

// Login
// POST https://json.schedulesdirect.org/20141201/token {"username": "vincent99", "password": sha1(password, 'hex') }
// {"code":0,"message":"OK","serverID":"20141201.web.1","datetime":"2021-04-02T21:19:51Z","token":"4ce002a4cea8bdd3ffed3f695137ceab"}%
//
// Get Lineups
// GET https://json.schedulesdirect.org/20141201/status
// 
// Get Lineup
// GET https://json.schedulesdirect.org/20141201/lineups/USA-DITV753-DEFAULT

// /
// /<tuner>[.m3u]
// /<tuner>/<channel>

const AsciiTable = require('ascii-table');
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const utils = require('./utils');
const schedulesdirect = require('./schedulesdirect');

const SD_USER = process.env.SCHEDULES_DIRECT_USERNAME;
const SD_PASS = process.env.SCHEDULES_DIRECT_PASSWORD;
const TUNE_ON_STREAM = utils.parseBool(process.env.TUNE_ON_STREAM, true);
const ENABLE_LOCKING = utils.parseBool(process.env.ENABLE_LOCKING, true);
const ANY_AVAILABLE = utils.parseBool(process.env.ANY_AVAILABLE, false);
const PORT = parseInt(process.env.PORT || 3000, 10);

const app = express();

const DEFAULT_DTV_PORT = '8080';
const DEFAULT_ENCODER_PORT = '80';

const TUNERS = [
  {name: 'living',  dtvHost: '10.0.0.94', dtvClient: '0C08B476BA23', encoderHost: '10.0.0.92', encoderPath: '/hdmi1'},
  {name: 'closet1', dtvHost: '10.0.0.94', dtvClient: '0C08B466C00A', encoderHost: '10.0.0.92', encoderPath: '/hdmi2'},
  {name: 'closet2', dtvHost: '10.0.0.94', dtvClient: '0C08B466BFA8', encoderHost: '10.0.0.92', encoderPath: '/hdmi3'},
];

const IDLE = 'idle';
const BUSY = 'busy';

for ( const tuner of TUNERS ) {
  tuner.state = IDLE;
}

const STATIONS = schedulesdirect.parseLineup(fs.readFileSync('lineup'));

app.get('/favicon(.ico)?', (req, res) => {
  res.status(404).end();
});

app.get('/', (req, res) => {
  const promises = TUNERS.map(tuner => getTuned(tuner));

  var table = new AsciiTable();
  table.setHeading('#', 'Tuner','State','Channel','Title');

  Promise.all(promises).then((tuned) => {
    for ( let i = 0 ; i < TUNERS.length ; i++ ) {
      const tuner = TUNERS[i];

      table.addRow(i, tuner.name, tuner.state, tuned[i].channel, tuned[i].title);
    }

    res.end(table.toString());
  });
});

app.get('/:tuner', (req, res) => {
  const name = path.parse(req.params.tuner).name;
  const tuner = tunerByName(name);

  if ( !tuner ) {
    res.status(404).end();
    return;
  }

  console.log(`GET Playlist ${name}`);

  // https://tvheadend.org/issues/4494
  res.write("#EXTM3U\n");

  for ( const s of STATIONS ) {
    res.write(`#EXTINF:-1 tvh-chnum="${s.channel}" tvg-id="${s.stationID}" tvg-uuid="${s.uuid}" tvh-epg="0",${s.name}\n`);
    res.write(`http://${req.headers.host}/${escape(name)}/stream/${s.channel}\n`);
  }

  res.end();
});

app.get('/:tuner/tune/:channel', (req, res) => {
  const tuner = tunerByName(req.params.tuner);

  console.log(`GET Tune ${tuner.name} -> ${req.params.channel}`);

  tune(tuner, req.params.channel).then((ok) => {
    if ( ok ) {
      res.end(`OK ${req.params.channel}`);
    } else {
      res.status(400).end('Error');
    }
  });
});

app.get('/:tuner/stream/:channel', (req, res) => {
  const tuner = tunerByName(req.params.tuner, ANY_AVAILABLE);
  const channel = req.params.channel;
  const lock = Math.random();

  console.log(`GET Stream ${tuner.name} -> ${req.params.channel}`);

  if ( ENABLE_LOCKING &&  tuner.state === BUSY ) {
    console.log(`Tuner ${tuner.name} in use`);
    res.status(400).end('Tuner in use');
    return;
  } else {
    tuner.state = BUSY;
    tuner.lock = lock;
  }

  console.log(`Starting Tuner ${tuner.name}`);

  if ( TUNE_ON_STREAM ) {
    return tune(tuner, channel).then((ok) => {
      console.log(`Changed channel to ${channel}`);
      return stream();
    });
  } else {
    return stream();
  }

  function stream() {
    const port = `${tuner.encoderPort || DEFAULT_ENCODER_PORT}`;

    let url = 'http://' + tuner.encoderHost;

    if ( port && port !== '80' ) {
      url += `:${port}`;
    }

    url += '/' + tuner.encoderPath.replace(/^\//, '');

    return fetch(url).then((stream) => {
      console.log(`Starting stream for ${tuner.name}`);
      stream.body.pipe(res);
      stream.body.on('end', done);
      req.on('close', done);

      function done() {
        console.log(`Stopping stream for ${tuner.name}`);

        if ( tuner.lock === lock && tuner.state === BUSY ) {
          tuner.state = IDLE;
          tuner.lock = null;
        }
      }
    });
  }
});


const server = app.listen(PORT, () => {
  console.info('Tune on Stream', TUNE_ON_STREAM);
  console.info('Locking', ENABLE_LOCKING);
  console.info(`Listening on port ${PORT}`);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
  console.log('Shutting down');
  server.close(function () {
    console.log('Stopped server');
    process.exit(0);
  });
}

function tunerByName(name, anyAvailable=false) {
  if ( anyAvailable ) {
    return TUNERS.find(x => x.state === IDLE) || TUNERS[0];
  }

  if ( name.match(/^\d+$/) ) {
    const int = parseInt(name, 10);

    return TUNERS[int];
  }

  return TUNERS.find(x => x.name === name);
}

function getTuned(tuner) {
  return fetchDTV(tuner, '/tv/getTuned')
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

  return fetchDTV(tuner, path).then((res) => {
    console.log(`Tune ${tuner.name} to ${channel}: ${res.ok}`);
    return res.ok;
  });
}

function fetchDTV(tuner, relative) {
  let url = `http://${tuner.dtvHost}:${tuner.dtvPort || DEFAULT_DTV_PORT}/` + relative.replace(/^\//, '');

  if ( tuner.dtvClient ) {
    url = addParam(url, 'clientAddr', tuner.dtvClient);
  }

  return fetch(url);
}

function addParam(url, key, val) {
  let out = url + (url.includes('?') ? '&' : '?');

  // val can be a string or an array of strings
  if ( !Array.isArray(val) ) {
    val = [val];
  }
  out += val.map((v) => {
    if ( v === null ) {
      return `${ encodeURIComponent(key) }`;
    } else {
      return `${ encodeURIComponent(key) }=${ encodeURIComponent(v) }`;
    }
  }).join('&');

  return out;
}

function addParams(url, params) {
  if ( params && typeof params === 'object' ) {
    Object.keys(params).forEach((key) => {
      url = addParam(url, key, params[key]);
    });
  }

  return url;
}

