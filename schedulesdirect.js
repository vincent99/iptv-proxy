const utils = require('./utils');

module.exports = {
  parseLineup(text) {
  const data = JSON.parse(text);
  const stationToChannel = {};
  for ( const m of data.map ) {
    let channel = m.channel.includes('-') ? m.channel : `${parseInt(m.channel, 10)}`;

    stationToChannel[m.stationID] = channel;
  }

  for ( const s of data.stations ) {
    s.channel = stationToChannel[s.stationID];
    s.uuid = utils.strPad(s.channel, 8, '0') + '-0000-0000-0000-' + utils.strPad(s.stationID || 0, 12, '0');
  }

  return data.stations;
  }
};
