local pairs = pairs
local extstr = require 'extstr'
local web = require 'web'
local nanoclock = require 'nanoclock'
local ctime = ngx.http_time
local time = ngx.time
local headers = ngx.req.get_headers
local match = ngx.re.match
local format = string.format
local random = math.random

local word_chars = {
	'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
	'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
	'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '_'
}

math.randomseed(nanoclock())

module(...)

function gen_session_key()
	local key = format('%08x', time())
	while #key < 48 do
		key = key .. word_chars[random(62)]
	end
	return key
end

function valid_session_key(id)
	return match(id, '^\\w{48}$', 'o') and true
end

function gen_token()
	local token = ''
	while #token < 8 do
		token = token .. word_chars[random(62)]
	end
	return token
end

function new(fields)
	local t, c = {}
	for k, v in pairs(fields) do
		c = { web.url_encode(k) .. '=' .. web.url_encode(v[1]) }
		if v.domain then c[2] = 'Domain=' .. v.domain end
		if v.path then c[#c + 1] = 'Path=' .. v.path end
		if v.duration then c[#c + 1] = 'Expires=' .. ctime(time() + v.duration) end
		if v.secure then c[#c + 1] = 'Secure' end
		if v.http then c[#c + 1] = 'HttpOnly' end
		t[#t + 1] = extstr.implode(c, '; ')
	end
	return t
end

function get()
	local a, header = {}, headers().Cookie
	if header then
		local h, e = extstr.explode(header, '; ')
		for c in pairs(h) do
			e = extstr.explode(h[c], '=')
			a[web.url_decode(e[1])] = web.url_decode(e[2])
		end
	end
	return a
end