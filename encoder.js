const fetch = require('node-fetch');
const config = require('./config');

const DEFAULT_ENCODER_PORT = '80';
const STREAM_TIMEOUT = 30000;

module.exports = {
  lock,
  unlock,
  stream,
};

function lock(tuner) {
  if ( config.ENABLE_LOCKING && tuner.state === config.BUSY ) {
    throw new Error('Tuner in use');
  }

  const id = (new Date().getTime());

  tuner.state = config.BUSY;
  tuner.lock = id;

  console.log(`[${tuner.name}] Locked: ${id}`);

  return id;
}

function stream(tuner, lock, req, res) {
  const port = `${tuner.encoderPort || DEFAULT_ENCODER_PORT}`;
  let closed = false;
  let url = 'http://' + tuner.encoderHost;

  if ( port && port !== '80' ) {
    url += `:${port}`;
  }

  url += '/' + tuner.encoderPath.replace(/^\//, '');

  if ( config.USE_REDIRECT ) {
    console.log(`[${tuner.name}] Redirecting to ${url}`);
    res.writeHead(302, 'Found', {
      Location: url,
    });
    res.end();
    done();
    return;
  }

  console.log(`[${tuner.name}] Loading stream`);
  return fetch(url).then((stream) => {
    let timer = setTimeout(done, STREAM_TIMEOUT);

    console.log(`[${tuner.name}] Streaming`);
    stream.body.on('data', (data) => {
      if ( closed ) {
        return;
      }

      clearTimeout(timer);
      timer = setTimeout(() => done(true), STREAM_TIMEOUT);
      res.write(data);
    });

    stream.body.on('end', done);
    req.on('close', done);
    req.on('end', done);
  }).catch((e) => {
    res.status(400).end('Error:' + e);
    done();
  });

  function done(timedOut) {
    if ( !closed ) {
      closed = true;
      console.log(`[${tuner.name}] Stopping`, (timedOut ? 'timed out' : ''));
      unlock(tuner, lock);

      res.end();
    }
  }
}

function unlock(tuner, id) {
  if ( tuner.state === config.BUSY ) {
    if ( tuner.lock === id ) {
      tuner.state = config.IDLE;
      tuner.lock = null;
      console.log(`[${tuner.name}] Unlocked`);
    } else {
      console.error(`[${tuner.name}] Unlocking: Mismatch`);
    }
  } else {
      console.error(`[${tuner.name}] Unlocking: Not locked?`);
  }
}
