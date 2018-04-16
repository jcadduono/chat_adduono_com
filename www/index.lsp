local cookies = require 'cookies'
local template = require 'template'
local web = require 'web'
local password = require 'password'

local errors = ''
local time = ngx.time()

local config = {
	dir = '/home/jc/chat.adduono.com/',
	sessionCookieName = 'adduono_chat',
	sessionCookieDuration = 604800
}

local requests, me, session

function initSession()
	local id = cookies.get()[config.sessionCookieName]
	if id and cookies.valid_session_key(id) then
		session = sql.chat('SELECT token, user, logged_in FROM sessions WHERE id = ' .. sql.safe(id) .. ' and expires > ' .. time .. ';').row[1]
		if session then
			session.id = id
			if session.logged_in == 1 and session.user ~= ngx.null then
				me = sql.chat('SELECT * FROM users WHERE id = ' .. session.user .. ';').row[1]
			end
			return
		end
	end
	session = {
		id = cookies.gen_session_key(),
		token = cookies.gen_token()
	}
	ngx.header['Set-Cookie'] = cookies.new({ [config.sessionCookieName] = { session.id, duration = config.sessionCookieDuration, path = '/' } })
	sql.chat('INSERT INTO sessions (id, token, expires) VALUES (' .. sql.safe(session.id) .. ', ' .. sql.safe(session.token) .. ', ' .. (time + config.sessionCookieDuration) .. ');')
end

function initRequests()
	ngx.req.read_body()
	requests = ngx.req.get_post_args()
end

function addError(message)
	errors = errors .. web.html_encode(message) .. '<br />'
end

function loggedIn()
	return session.logged_in == 1
end

function login()
	if #requests.username then
		if not #requests.password then
			addError('Invalid password.')
		else
			me = sql.chat('SELECT id, name, password, salt FROM users WHERE name = ' .. sql.safe(requests.username) .. ';').row[1]
			if me then
				if me.password == password.hash(requests.password, me.salt) then
					session.user = me.id
					session.logged_in = 1
					sql.chat('UPDATE sessions SET logged_in = 1, user = ' .. session.user .. ' WHERE id = ' .. sql.safe(session.id) .. ';')
					sql.chat('UPDATE users SET last_online = ' .. time .. ', ip = ' .. sql.safe(ngx.var.remote_addr) .. ' WHERE id = ' .. session.user .. ';')
				else
					addError('Invalid password. Please check to see if your [Caps Lock] key is on as passwords are case-sensitive!')
				end
			else
				addError('That username doesn\'t exist.')
			end
		end
	else
		addError('Invalid username. Usernames must be 3 to 18 characters long and only letters (a-Z), numbers (0-9), hyphens (-), underscores (_), and periods (.) are allowed.')
	end
end

function logout()
	session.logged_in = 0
	sql.chat('UPDATE sessions SET logged_in = 0 WHERE id = ' .. sql.safe(session.id) .. ';')
end

function handleRequests()
	if requests.token == session.token then
		if loggedIn() then
			if requests.logout then
				logout()
			end
		end
		if requests.login then
			login()
		end
	end
end

function homeHTML()
	return template.parse(config.dir .. 'template/home.html', {
		TOKEN = session.token,
		USERNAME = web.html_encode(me.name)
	})
end

function loginHTML()
	return template.parse(config.dir .. 'template/login.html', {
		TOKEN = session.token,
		ERRORS = errors
	})
end

function sendContent()
	ngx.header['Cache-Control'] = 'no-cache, must-revalidate'
	ngx.header['Expires'] = '0'
	ngx.header['Content-Type'] = 'text/html; charset=UTF-8'
	ngx.print(loggedIn() and homeHTML() or loginHTML())
	ngx.eof()
end

initSession()
initRequests()
handleRequests()
sendContent()
