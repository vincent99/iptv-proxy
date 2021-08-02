const dgram = require('dgram');
const fetch = require('node-fetch');
const config = require('./config');
// const dvbtee = require('dvbtee');


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

function urlFor(tuner) {
  const port = `${tuner.encoderPort || DEFAULT_ENCODER_PORT}`;
  let closed = false;
  let url = (tuner.encoderUdp ? 'rtp://@' : 'http://') + tuner.encoderHost;

  if ( port && port !== '80' ) {
    url += `:${port}`;
  }

  url += '/' + tuner.encoderPath.replace(/^\//, '');

  return tuner;
}

function stream(tuner, lock, req, res) {
  let client;
  let url = urlFor(tuner);
  let closed = false;
  let started = {};
  let ignored = {};
  let continuity = {};
  let bytes = 0;

  if ( config.USE_REDIRECT && !tuner.encoderUdp ) {
    console.log(`[${tuner.name}] Redirecting to ${url}`);
    res.writeHead(302, 'Found', {
      Location: url,
    });
    res.end();
    done();
    return;
  }

  const byteTimer = setInterval(() => {
    const haveIgnored = Object.keys(ignored).length > 0;

    if ( bytes > 0 || haveIgnored ) {
      console.log(`[${tuner.name}] ${bytes} bytes` + (haveIgnored ? `, Ignored ${JSON.stringify(ignored)}` : ''));
      bytes = 0;
      ignored = {};
    } else if ( closed ) {
      clearInterval(byteTimer);
    }
  }, 1000);

  if ( tuner.encoderUdp ) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.useChunkedEncodingByDefault = false;

    let timer = setTimeout(done, STREAM_TIMEOUT);
    console.log(`[${tuner.name}] Loading UDP stream`);

    client = dgram.createSocket({type: 'udp4', reuseAddr: true});
    client.bind(tuner.encoderPort);

    client.on('listening', () => {
      const addr = client.address();

      console.log(`[${tuner.name}] Connected to UDP stream on ${addr.address}:${addr.port}`);
      client.setBroadcast(true);
      client.setMulticastTTL(128);
      client.addMembership(tuner.encoderHost);
    });

    client.on('message', (data) => {
      bytes += data.length;

      if ( closed ) {
        console.log(`[${tuner.name}] UDP Data after Close`, data.length);
        return;
      }

      clearTimeout(timer);
      timer = setTimeout(() => done(true), STREAM_TIMEOUT);

      const p = parse(data);

      if ( config.PUSI_UDP ) {
        if ( p.pid === 8191 ) {
          return;
        } else if ( started[0] || p.pid === 0 ) {
          if ( !started[p.pid] && (p.pusi === 1 || p.adaptation === 2) ) {
            console.log(`[${tuner.name}] UDP Start`, p.pid, JSON.stringify(p));
            started[p.pid] = true;
          }
        }

        if ( !started[p.pid] ) {
          ignored[p.pid] = (ignored[p.pid] || 0) + 1;
          return;
        }
      }

      let cur = p.continuity;
      let entry = continuity[p.pid];

      if ( config.REORDER_UDP && !entry ) {
        console.log(`[${tuner.name}] Creating continuity for ${p.pid} = ${cur}`);
        continuity[p.pid] = { next: cur, buf: new Array(16) };
        entry = continuity[p.pid];
      }

      if ( config.REORDER_UDP && (p.adaptation & 0x01) ) {
        if ( entry.next === cur ) {
          console.log(`[${tuner.name}] Got expected for ${p.pid} = ${cur}`);
          res.write(data);
          entry.next = (cur + 1) % 16;
          entry.buf[cur] = null;

          let cc = entry.next;
          while ( entry.buf[cc] ) {
            console.log(`[${tuner.name}] Catching up ${p.pid} from ${cur} to ${cc}`);
            res.write(entry.buf[cc]);
            entry.buf[cc] = null;
            cc = (cc + 1) % 16;
            entry.next = cc;
          }
        } else {
          console.log(`[${tuner.name}] Buffering ${p.pid}, expected ${entry.next}, got ${cur}`);
          entry.buf[cur] = data;
        }
      } else {
        res.write(data);
      }
    });

    client.on('error', (e) => {
      console.log(`[${tuner.name}] UDP Error:`, e);
    });

    req.on('close', done);
    req.on('end', done);

    return;
  }

  console.log(`[${tuner.name}] Loading HTTP stream`);
  return fetch(url).then((stream) => {
    let timer = setTimeout(done, STREAM_TIMEOUT);

    console.log(`[${tuner.name}] Streaming`);
    stream.body.on('data', (data) => {
      bytes += data.length;

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
    try {
      if ( !closed ) {
        closed = true;
        console.log(`[${tuner.name}] Stopping`, (timedOut ? 'timed out' : ''));
        unlock(tuner, lock);

        res.end();

        if ( client ) {
          client.close();
        }
      }
    } catch (err) {
      console.error('Caught error:', err);
    }
  }
}

function parse(data) {
  const header = (data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3];
  const out = {
    // raw:            header,
    sync:           (header & 0xff000000) >> 24,
    // tei:            (header & 0x800000) >> 23,
    pusi:           (header & 0x400000) >> 22,
    // priority:       (header & 0x200000) >> 21,
    pid:            (header & 0x1fff00) >> 8,
    // scramble:       (header & 0xc0) >> 6,
    adaptation:     (header & 0x30) >> 4,
    continuity:     ( data[3] & 0x0f),
    adaptation_len: 0,
  };

  const hasAdaptation = (out.adaptation & 0x2) > 0;

  if ( hasAdaptation ) {
    out.adaptation_len = data[4];
    out.discontinuity =     (data[5] & 0x80) >> 7;
    out.random_access =     (data[5] & 0x40) >> 6;
    out.es_priority =       (data[5] & 0x20) >> 5;
    out.pcr =               (data[5] & 0x10) >> 4;
    out.opcr =              (data[5] & 0x08) >> 3;
    out.splice =            (data[5] & 0x04) >> 2;
    out.transport_private = (data[5] & 0x02) >> 1;
    out.adaptation_ext =    (data[5] & 0x01);
  }

  const offset = 4 + (hasAdaptation ? 1 + out.adaptation_len : 0);
  out.prefix = (data[offset] << 16) | (data[offset+1] << 8) | (data[offset+2]);

  return out;
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
