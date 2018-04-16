local sha256 = require 'sha256'
local random = math.random
local char = string.char
local nanoclock = require 'nanoclock'

math.randomseed(nanoclock())

module(...)

function hash(password, salt)
	return sha256.generate(salt .. password)
end

function generate_salt()
	local salt, i = ''
	for i = 1, 8 do
		salt = salt .. char(random(32, 126))
	end
	return salt
end