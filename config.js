const utils = require('./utils');

const IDLE = 'idle';
const BUSY = 'busy';

const SD_USER = process.env.SCHEDULES_DIRECT_USERNAME;
const SD_PASS = process.env.SCHEDULES_DIRECT_PASSWORD;
const TUNE_ON_STREAM = utils.parseBool(process.env.TUNE_ON_STREAM, true);
const ENABLE_LOCKING = utils.parseBool(process.env.ENABLE_LOCKING, true);
const PORT = parseInt(process.env.PORT || 3000, 10);

const TUNERS = [
  {name: 'closet1', dtvHost: '10.0.0.94', dtvClient: '0C08B466C00A', encoderHost: '10.0.0.92', encoderPath: '/hdmi2'},
  {name: 'closet2', dtvHost: '10.0.0.94', dtvClient: '0C08B466BFA8', encoderHost: '10.0.0.92', encoderPath: '/hdmi3'},
  {name: 'living',  dtvHost: '10.0.0.94', dtvClient: '0C08B476BA23', encoderHost: '10.0.0.92', encoderPath: '/hdmi1'},
];

for ( const tuner of TUNERS ) {
  tuner.state = IDLE;
}

module.exports = {
  SD_USER,
  SD_PASS,
  TUNE_ON_STREAM,
  ENABLE_LOCKING,
  PORT,
  TUNERS,

  IDLE,
  BUSY,
};
