module.exports.parse = function(str) {
    var obj = {}
    str.split(/; */).forEach(function(pair) {
        var idx = pair.indexOf('=')
        if (idx < 0) return;
        var key = pair.substr(0, idx).trim()
        var val = pair.substr(++idx, pair.length).trim();
        if ('"' == val[0]) val = val.slice(1, -1);
        if (obj[key] === undefined) {
            try { obj[key] = decodeURIComponent(val); }
			catch (e) { obj[key] = val; }
        }
    });
    return obj;
};

module.exports.validate_key = function(key) {
	return /^\w{48}$/.test(key);
}
