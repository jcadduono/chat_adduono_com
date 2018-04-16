local cookies = require 'cookies'
local template = require 'template'
local web = require 'web'
local captcha = require 'recaptcha'
local password = require 'password'

local time = ngx.time()
local ip = ngx.var.remote_addr

local config = {
	dir = '/home/jc/chat.adduono.com/register/',
	sessionCookieName = 'adduono_chat',
	recaptchaPrivateKey = '6LfjduUSAAAAAICmaav3TFoOFLkWZiccIiBEiSP1',
	recaptchaPublicKey = '6LfjduUSAAAAAK-ggmlNrqRc3b6U1HQ4AiraTPUo'
}

local requests, me, session, recaptcha_error

function initSession()
	local id = cookies.get()[config.sessionCookieName]
	if id and cookies.valid_session_key(id) then
		session = sql.chat('SELECT token, user, logged_in FROM sessions WHERE id = ' .. sql.safe(id) .. ' and expires > ' .. time .. ';').row[1]
		if session then
			session.id = id
			return true
		end
	end
end

function initRequests()
	ngx.req.read_body()
	requests = ngx.req.get_post_args()
end

function loggedIn()
	return session.logged_in == 1
end

function registeredUser()
	return sql.chat('SELECT id FROM users WHERE name = ' .. sql.safe(requests.username) .. ' OR email = ' .. sql.safe(requests.email) .. ';').row[1]
end

function validUsernameAndEmail(username, email)
	return ngx.re.match(requests.username, '^[\\w.-]{3,18}$', 'o') and ngx.re.match(requests.email, '^[\\w.-]+@[a-z0-9.-]+\\.[a-z]{2,4}$', 'io') and registeredUser() == nil
end

function validPassword()
	return ngx.re.match(requests.password, '^\\S{6,32}$', 'o')
end

function createAccount()
	local salt = password.generate_salt()
	local password_salted = password.hash(requests.password, salt)
	local id = sql.chat('INSERT INTO users (name, password, salt, email) VALUES (' .. sql.safe(requests.username) .. ', ' .. sql.safe(password_salted) .. ', ' .. sql.safe(salt) .. ', ' .. sql.safe(requests.email) .. ');').insert_id
	return id ~= nil and sql.chat('SELECT * FROM users WHERE id = ' .. id .. ';').row[1]
end

function login()
	session.logged_in = 1
	session.user = me.id
	sql.chat('UPDATE sessions SET logged_in = 1, user = ' .. me.id .. ' WHERE id = ' .. sql.safe(session.id) .. ';')
end

function handleRequests()
	if requests.token == session.token then
		if requests.username ~= nil and requests.password ~= nil and requests.password2 == requests.password and requests.email ~= nil and requests.recaptcha_challenge_field ~= nil and requests.recaptcha_response ~= nil then
			if not validUsernameAndEmail(requests.username, requests.email) and validPassword(requests.password) then
				return
			end
			if captcha.verify(config.recaptchaPrivateKey, ip, requests.recaptcha_challenge_field, requests.recaptcha_response) then
				me = createAccount()
				if me ~= nil then
					login()
				end
			else
				recaptcha_error = 'Incorrect answer, please try again.'
			end
		end
	end
end

function registerHTML()
	return template.parse(config.dir .. 'template/register.html', {
		TOKEN = session.token,
		RECAPTCHA_PUBLIC_KEY = config.recaptchaPublicKey,
		RECAPTCHA_ERROR = recaptcha_error or '',
		USERNAME = requests.username ~= nil and web.html_encode(requests.username) or '',
		PASSWORD = requests.password ~= nil and web.html_encode(requests.password) or '',
		PASSWORD2 = requests.password2 ~= nil and web.html_encode(requests.password2) or '',
		EMAIL = requests.email ~= nil and web.html_encode(requests.email) or '',
	})
end

function successHTML()
	return template.parse(config.dir .. 'template/success.html', {
		USERNAME = web.html_encode(me.name)
	})
end

function sendContent()
	ngx.header['Cache-Control'] = 'no-cache, must-revalidate'
	ngx.header['Expires'] = '0'
	ngx.header['Content-Type'] = 'text/html; charset=UTF-8'
	ngx.print(me == nil and registerHTML() or successHTML())
	ngx.eof()
end

function redirectToLogin()
	ngx.redirect('/', ngx.HTTP_MOVED_TEMPORARILY)
end

if not initSession() or loggedIn() then
	redirectToLogin()
else
	initRequests()
	handleRequests()
	sendContent()
end