
// Login
// POST https://json.schedulesdirect.org/20141201/token {"username": "vincent99", "password": sha1(password, 'hex') }
// {"code":0,"message":"OK","serverID":"20141201.web.1","datetime":"2021-04-02T21:19:51Z","token":"4ce002a4cea8bdd3ffed3f695137ceab"}%
//
// Get Lineups
// GET https://json.schedulesdirect.org/20141201/status
// 
// Get Lineup
// GET https://json.schedulesdirect.org/20141201/lineups/USA-DITV753-DEFAULT

const fs = require('fs');
const utils = require('./utils');

module.exports = {
  parseLineup,
  m3u,
};

function m3u(tunerName, hostHeader) {
  const stations = parseLineup(fs.readFileSync('lineup.json'));
  const channels = JSON.parse(fs.readFileSync('channels.json'));

  const channelMap = {};
  const seen = {};

  for ( const channel of channels ) {
    channelMap[`${channel}`] = true;
  }

  let out = ["#EXTM3U"];

  for ( const s of stations ) {
    if ( !channelMap[s.channel] ) {
      continue;
    }

    if ( seen[`${s.channel}`] ) {
      continue;
    }

    seen[s.channel] = true;

    out.push(`#EXTINF:-1 tvh-chnum="${s.channel}" tvg-id="${s.stationID}" tvg-uuid="${s.uuid}" tvh-epg="0",${s.name}`);
    out.push(`http://${hostHeader}/${escape(tunerName)}/stream/${s.channel}`);
  }

  return out.join("\n");
}

function parseLineup(text) {
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
