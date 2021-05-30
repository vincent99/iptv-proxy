#!/usr/bin/env node

// /
// /<tuner>[.m3u]
// /<tuner>/tune/<channel>
// /<tuner>/stream/<channel>
// /stream/<channel>[/tuner]

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

      table.addRow(i, tuner.name, tuner.state, `${tuned[i].channel}`, tuned[i].title);
    }

    res.end(table.toString());
  });
});

app.get('/:tuner', (req, res) => {
  const name = path.parse(req.params.tuner).name;
  const tuner = tunerByName(name);

  if ( !tuner ) {
    noTunerError(res, name);
    return;
  }

  console.log(`GET Playlist ${name}`);

  const m3u = schedulesdirect.m3u(name, req.headers.host);
  res.end(m3u);
});

app.get('/:tuner/tune/:channel', (req, res) => {
  const tuner = tunerByName(req.params.tuner);

  if ( !tuner ) {
    noTunerError(res, name);
    return;
  }

  console.log(`GET Tune ${tuner.name} -> ${req.params.channel}`);

  directv.tune(tuner, req.params.channel).then((ok) => {
    if ( ok ) {
      res.end(`[${tuner.name} Tuned ${req.params.channel}`);
    } else {
      res.status(400).end('Error');
    }
  });
});

app.get('/:tuner/stream/:channel', (req, res) => {
  return stream(req, res, req.params.tuner, req.params.channel);
});

app.get('/stream/:channel/:tuner', (req, res) => {
  return stream(req, res, req.params.tuner, req.params.channel);
});

app.get('/stream/:channel', (req, res) => {
  return stream(req, res, config.ANY, req.params.channel);
});

const server = app.listen(config.PORT, () => {
  console.info('Tune on Stream', config.TUNE_ON_STREAM);
  console.info('Locking', config.ENABLE_LOCKING);
  console.info('Redirect', config.USE_REDIRECT);
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

  if ( name === config.ANY ) {
    for ( let i = 0 ; i < tuners.length ; i++ ) {
      if ( tuners[i].state === config.IDLE ) {
        return tuners[i];
      }
    }

    return null;
  }

  if ( name.match(/^\d+$/) ) {
    const int = parseInt(name, 10);

    return tuners[int];
  }

  return tuners.find(x => x.name === name);
}

function stream(req, res, name, channel) {
  const tuner = tunerByName(name);
  let lock;

  if ( !tuner ) {
    noTunerError(res, name);
    return;
  }

  try {
    lock = encoder.lock(tuner);
    console.log(`GET Stream ${tuner.name} -> Ok ${channel}`);
  } catch (e) {
    console.error(`GET Stream ${tuner.name} -> Error in use`);
    res.status(400).end('Tuner in use');
    return;
  }

  console.log(`[${tuner.name}] Starting`);

  if ( config.TUNE_ON_STREAM ) {
    return directv.tune(tuner, channel).then((ok) => {
      if ( ok ) {
        console.log(`[${tuner.name}] Changed channel to ${channel}`);
        return encoder.stream(tuner, lock, req, res);
      } else {
        console.error(`[${tuner.name}] Error changing channel to ${channel}`);
        res.status(400).end('Error changing channel');
      }
    });
  } else {
    return encoder.stream(tuner, lock, req, res);
  }
}

function noTunerError(res, name) {
  if ( name === config.ANY ) {
    res.status(400).end('No tuners available');
  } else {
    res.status(404).end('Tuner not found');
  }
}
