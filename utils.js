module.exports = {
  strPad,
  parseBool,
  addParam,
  addParams,
  sleep
};

function strPad(str, toLength, padChars = ' ', right = false) {
  str = `${ str }`;

  if (str.length >= toLength) {
    return str;
  }

  const neededLen = toLength - str.length + 1;
  const padStr = (new Array(neededLen)).join(padChars).substr(0, neededLen);

  if (right) {
    return str + padStr;
  } else {
    return padStr + str;
  }
}

function parseBool(str, def=false) {
  str = `${str}`.trim().toLowerCase();

  if ( !str ) {
    return def;
  }

  if ( str === '1' || str === 't' || str === 'true' ) {
    return true;
  }

  if ( str === '0' || str === 'f' || str === 'false' ) {
    return false;
  }

  return def;
}

function addParam(url, key, val) {
  let out = url + (url.includes('?') ? '&' : '?');

  // val can be a string or an array of strings
  if ( !Array.isArray(val) ) {
    val = [val];
  }
  out += val.map((v) => {
    if ( v === null ) {
      return `${ encodeURIComponent(key) }`;
    } else {
      return `${ encodeURIComponent(key) }=${ encodeURIComponent(v) }`;
    }
  }).join('&');

  return out;
}

function addParams(url, params) {
  if ( params && typeof params === 'object' ) {
    Object.keys(params).forEach((key) => {
      url = addParam(url, key, params[key]);
    });
  }

  return url;
}

function sleep(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}
