const utils = require('./utils');

const ANY = 'any';
const IDLE = 'idle';
const BUSY = 'busy';

// const SD_USER = process.env.SCHEDULES_DIRECT_USERNAME;
// const SD_PASS = process.env.SCHEDULES_DIRECT_PASSWORD;
const TUNE_ON_STREAM = utils.parseBool(process.env.TUNE_ON_STREAM, true);
const USE_REDIRECT = utils.parseBool(process.env.USE_REDIRECT, true);
const ENABLE_LOCKING = utils.parseBool(process.env.ENABLE_LOCKING, false);
const PORT = parseInt(process.env.PORT || 3000, 10);
let TUNERS;

if ( process.env.TUNERS ) {
  TUNERS = JSON.parse(process.env.TUNERS);
} else {
  TUNERS = [
    {"name": "closet1", "dtvHost": "10.0.0.94", "dtvClient": "0C08B466C00A", "encoderHost": "10.0.0.95", "encoderPath": "/hdmi1"},
    {"name": "closet2", "dtvHost": "10.0.0.94", "dtvClient": "0C08B466BFA8", "encoderHost": "10.0.0.95", "encoderPath": "/hdmi2"},
    {"name": "closet3", "dtvHost": "10.0.0.94", "dtvClient": "0C08B469AE47", "encoderHost": "10.0.0.95", "encoderPath": "/hdmi2"},
    {"name": "living",  "dtvHost": "10.0.0.94", "dtvClient": "0C08B476BA23", "encoderHost": "10.0.0.95", "encoderPath": "/hdmi4"},
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
  PORT,
  TUNERS,

  ANY,
  IDLE,
  BUSY,
};
