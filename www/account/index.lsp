local cookies = require 'cookies'
local template = require 'template'
local web = require 'web'
local password = require 'password'

local time = ngx.time()

local config = {
	dir = '/home/jc/chat.adduono.com/account/',
	sessionCookieName = 'adduono_chat'
}

local requests, me, session, change_response

function initSession()
	local id = cookies.get()[config.sessionCookieName]
	if id and cookies.valid_session_key(id) then
		session = sql.chat('SELECT token, user, logged_in FROM sessions WHERE id = ' .. sql.safe(id) .. ' and expires > ' .. time .. ';').row[1]
		if session and session.logged_in == 1 and session.user ~= ngx.null then
			me = sql.chat('SELECT * FROM users WHERE id = ' .. session.user .. ';').row[1]
			return me and true
		end
	end
end

function initRequests()
	ngx.req.read_body()
	requests = ngx.req.get_post_args()
end

function validUsername(username)
	return ngx.re.match(username, '^[\\w.-]{3,18}$', 'o') and not sql.chat('SELECT id FROM users WHERE name = ' .. sql.safe(username) .. ';').row[1]
end

function validEmail(email)
	return ngx.re.match(email, '^[\\w.-]+@[a-z0-9.-]+\\.[a-z]{2,4}$', 'io') and not sql.chat('SELECT id FROM users WHERE email = ' .. sql.safe(email) .. ';').row[1]
end

function validPassword(pass)
	return ngx.re.match(pass, '^\\S{6,32}$', 'o')
end

function changeUsername(username)
	sql.chat('UPDATE users SET name = ' .. sql.safe(username) .. ' WHERE id = ' .. me.id .. ';')
	me.name = username
	change_response = 'Your username has been changed successfully.'
end

function changeEmail(email)
	sql.chat('UPDATE users SET email = ' .. sql.safe(email) .. ' WHERE id = ' .. me.id .. ';')
	me.email = email
	change_response = 'Your email address has been changed successfully.'
end

function changePassword(pass)
	local salt = password.generate_salt()
	local password_salted = password.hash(pass, salt)
	sql.chat('UPDATE users SET password = ' .. sql.safe(password_salted) .. ', salt = ' .. sql.safe(salt) .. ' WHERE id = ' .. me.id .. ';')
	change_response = 'Your password has been changed successfully.'
end

function handleRequests()
	if requests.token == session.token then
		if requests.username ~= nil and validUsername(requests.username) then
			return changeUsername(requests.username)
		end
		if requests.email ~= nil and validEmail(requests.email) then
			return changeEmail(requests.email)
		end
		if requests.password ~= nil and requests.password2 == requests.password and validPassword(requests.password) then
			return changePassword(requests.password)
		end
	end
end

function sendContent()
	ngx.header['Cache-Control'] = 'no-cache, must-revalidate'
	ngx.header['Expires'] = '0'
	ngx.header['Content-Type'] = 'text/html; charset=UTF-8'
	ngx.print(template.parse(config.dir .. 'template/account.html', {
		TOKEN = session.token,
		USERNAME = me.name,
		EMAIL = me.email,
		RESPONSE = change_response or ''
	}))
	ngx.eof()
end

function redirectToLogin()
	ngx.redirect('/', ngx.HTTP_MOVED_TEMPORARILY)
end

if initSession() then
	initRequests()
	handleRequests()
	sendContent()
else
	redirectToLogin()
end