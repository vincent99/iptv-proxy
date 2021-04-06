#!/usr/bin/env node

// /
// /<tuner>[.m3u]
// /<tuner>/tune/<channel>
// /<tuner>/stream/<channel>

const AsciiTable = require('ascii-table');
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const config = require('./config');
const schedulesdirect = require('./schedulesdirect');
const directv = require('./directv');
const encoder = require('./encoder');

const app = express();

app.get('/favicon(.ico)?', (req, res) => {
  res.status(404).end();
});

app.get('/', (req, res) => {
  const tuners = config.TUNERS;

  const promises = tuners.map(tuner => directv.status(tuner));

  var table = new AsciiTable();
  table.setHeading('#', 'Tuner','State','Channel','Title');

  Promise.all(promises).then((tuned) => {
    for ( let i = 0 ; i < tuners.length ; i++ ) {
      const tuner = tuners[i];

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

  const m3u = schedulesdirect.m3u(name, req.headers.host);
  res.end(m3u);
});

app.get('/:tuner/tune/:channel', (req, res) => {
  const tuner = tunerByName(req.params.tuner);

  console.log(`GET Tune ${tuner.name} -> ${req.params.channel}`);

  directv.tune(tuner, req.params.channel).then((ok) => {
    if ( ok ) {
      res.end(`OK ${tuner.name} ${req.params.channel}`);
    } else {
      res.status(400).end('Error');
    }
  });
});

app.get('/:tuner/stream/:channel', (req, res) => {
  const tuner = tunerByName(req.params.tuner);
  const channel = req.params.channel;
  let lock;

  console.log(`GET Stream ${tuner.name} -> ${req.params.channel}`);

  try {
    lock = encoder.lock(tuner);
  } catch (e) {
    console.log(`Stream ${tuner.name} in use: ${e}`);
    res.status(400).end('Tuner in use');
    return;
  }

  console.log(`Starting Tuner ${tuner.name}`);

  if ( config.TUNE_ON_STREAM ) {
    return directv.tune(tuner, channel).then((ok) => {
      if ( ok ) {
        console.log(`Changed channel to ${channel}`);
        return encoder.stream(tuner, lock, req, res);
      } else {
        console.error(`Error changing channel to ${channel}`);
        res.status(400).end('Error changing channel');
      }
    });
  } else {
    return encoder.stream(tuner, lock, req, res);
  }
});

const server = app.listen(config.PORT, () => {
  console.info('Tune on Stream', config.TUNE_ON_STREAM);
  console.info('Locking', config.ENABLE_LOCKING);
  console.info(`Listening on port ${config.PORT}`);
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

function tunerByName(name) {
  const tuners = config.TUNERS;

  if ( name === 'any' ) {
    return tuners.find(x => x.state === config.IDLE) || tuners[0];
  }

  if ( name.match(/^\d+$/) ) {
    const int = parseInt(name, 10);

    return tuners[int];
  }

  return tuners.find(x => x.name === name);
}
