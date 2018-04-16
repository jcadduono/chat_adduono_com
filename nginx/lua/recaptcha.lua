local enc = require 'web'.url_encode
local tcp = ngx.socket.tcp

module(...)

function verify(private_key, ip, challenge, response)
	local body = 'privatekey=' .. enc(private_key) .. '&remoteip=' .. enc(ip) .. '&challenge=' .. enc(challenge) .. '&response=' .. enc(response)
	local data = 'POST /recaptcha/api/verify HTTP/1.0\r\nContent-Type: application/x-www-form-urlencoded\r\nContent-Length: ' .. #body .. '\r\n\r\n' .. body .. '\r\n'
	local sock, line, err = tcp()
	sock:settimeout(1000)
	sock:connect('www.google.com', 80)
	sock:send(data)
	while true do
		line = sock:receive('*l')
		if line == 'true' or line == nil then
			break
		elseif line == 'false' then
			err = sock:receive('*l')
			break
		end
	end
	sock:close()
	return line == 'true', err
end