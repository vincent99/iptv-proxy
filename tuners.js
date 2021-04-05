module.exports = {
  m3u,
}

function m3u(tunerName, hostHeader) {
  let out = ["#EXTM3U"];

  for ( const s of STATIONS ) {
    out.push(`#EXTINF:-1 tvh-chnum="${s.channel}" tvg-id="${s.stationID}" tvg-uuid="${s.uuid}" tvh-epg="0",${s.name}`);
    out.push(`http://${hostHeader}/${escape(tunerName)}/stream/${s.channel}`);
  }

  return out.join("\n");
}
