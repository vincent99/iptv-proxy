const utils = require('./utils');

const ANY = 'any';
const IDLE = 'idle';
const BUSY = 'busy';

// const SD_USER = process.env.SCHEDULES_DIRECT_USERNAME;
// const SD_PASS = process.env.SCHEDULES_DIRECT_PASSWORD;
const TUNE_ON_STREAM = utils.parseBool(process.env.TUNE_ON_STREAM, true);
const USE_REDIRECT = utils.parseBool(process.env.USE_REDIRECT, true);
const ENABLE_LOCKING = utils.parseBool(process.env.ENABLE_LOCKING, false);
const REORDER_UDP = utils.parseBool(process.env.REORDER_UDP, false);
const PUSI_UDP = utils.parseBool(process.env.PUSI_UDP, false);
const PORT = parseInt(process.env.PORT || 3000, 10);
let TUNERS;

if ( process.env.TUNERS ) {
  TUNERS = JSON.parse(process.env.TUNERS);
} else {
  TUNERS = [
    {"name": "closet1", "dtvHost": "10.0.0.94", "dtvClient": "0C08B466C00A", "encoderUdp": true, "encoderHost": "224.2.2.2", "encoderPort": 1234, "encoderPath": ""},
    {"name": "closet2", "dtvHost": "10.0.0.94", "dtvClient": "0C08B466BFA8", "encoderUdp": true, "encoderHost": "224.2.2.2", "encoderPort": 1235, "encoderPath": ""},
    {"name": "closet3", "dtvHost": "10.0.0.94", "dtvClient": "0C08B469AE47", "encoderUdp": true, "encoderHost": "224.2.2.2", "encoderPort": 1236, "encoderPath": ""},
    {"name": "living",  "dtvHost": "10.0.0.94", "dtvClient": "0C08B476BA23", "encoderUdp": true, "encoderHost": "224.2.2.2", "encoderPort": 1237, "encoderPath": ""},
  ];
}

for ( const tuner of TUNERS ) {
  tuner.state = IDLE;
}

module.exports = {
  // SD_USER,
  // SD_PASS,
  TUNE_ON_STREAM,
  USE_REDIRECT,
  ENABLE_LOCKING,
  PUSI_UDP,
  REORDER_UDP,
  PORT,
  TUNERS,

  ANY,
  IDLE,
  BUSY,
};
