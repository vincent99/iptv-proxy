const fetch = require('node-fetch');
const config = require('./config');

const DEFAULT_ENCODER_PORT = '80';

module.exports = {
  lock,
  unlock,
  stream,
};

function lock(tuner) {
  if ( config.ENABLE_LOCKING &&  tuner.state === config.BUSY ) {
    throw new Error('Tuner in use');
  }

  const id = (new Date().getTime());

  console.log(`Locked ${tuner.name}: ${id}`);

  tuner.state = config.BUSY;
  tuner.lock = id;

  return id;
}

function stream(tuner, lock, req, res) {
  const port = `${tuner.encoderPort || DEFAULT_ENCODER_PORT}`;

  let url = 'http://' + tuner.encoderHost;

  if ( port && port !== '80' ) {
    url += `:${port}`;
  }

  url += '/' + tuner.encoderPath.replace(/^\//, '');

  console.log(`Loading stream for ${tuner.name}`);
  return fetch(url).then((stream) => {
    console.log(`Streaming ${tuner.name}`);
    stream.body.pipe(res);
    stream.body.on('end', done);
    req.on('close', done);

    function done() {
      console.log(`Stopping ${tuner.name}`);
      unlock(tuner, lock);
    }
  });
}

function unlock(tuner, id) {
  if ( tuner.lock === id && tuner.state === config.BUSY ) {
    console.log(`Unlocking ${tuner.name}`);
    tuner.state = config.IDLE;
    tuner.lock = null;
  } else {
    console.log(`Unlocking ${tuner.name}: Mismatch`);
  }
}
