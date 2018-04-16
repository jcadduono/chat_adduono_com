local tonumber = tonumber

module(...)

function url_encode(s)
	return (s:gsub('\r?\n', '\r\n'):gsub('([^%w%-%.%_%~ ])', function (c) return ('%%%02X'):format(c:byte()) end):gsub(' ', '+'))
end

function url_decode(s)
	return (s:gsub('%%(%x%x)', function (c) return (tonumber(c, 16) .. ''):char() end):gsub('+', ' '))
end

function html_encode(s)
	return (s:gsub('&', '&amp;'):gsub('\'', '&#39;'):gsub('"', '&quot;'):gsub('<', '&lt;'):gsub('>', '&gt;'))
end

function html_decode(s)
	return (s:gsub('&#39;', '\''):gsub('&quot;', '"'):gsub('&lt;', '<'):gsub('&gt;', '>'):gsub('&amp;', '&'))
end