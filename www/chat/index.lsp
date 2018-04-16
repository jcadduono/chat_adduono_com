local cookies = require 'cookies'
local template = require 'template'
local web = require 'web'

local time = ngx.time()

local config = {
	dir = '/home/jc/chat.adduono.com/chat/',
	sessionCookieName = 'adduono_chat',
	photoFormat = '../profile/photos/%s.jpg'
}

local role = {
	[1] = 'user',
	[2] = 'host',
	[3] = 'admin',
	[4] = 'owner',
	user = 1,
	host = 2,
	admin = 3,
	owner = 4,
}

local requests, me, session, rooms, banned, online, online_count

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

function initRooms()
	online_count = 0
	rooms = sql.chat('SELECT * FROM chat_room_count;').row
	for i = 1, #rooms do
		online_count = online_count + rooms[i].users
	end
end

function checkIfBanned()
	banned = sql.chat('SELECT banned_by, expires, reason FROM chat_bans_resolve WHERE id = ' .. me.id .. ';').row[1]
	if banned and banned.banned_by == ngx.null then
		banned.banned_by = 'someone'
	end
end

function handleRequests()
	if requests.token == session.token then
		if requests.room and not (banned or online) then
			requests.room = tonumber(requests.room)
			for i = 1, #rooms do
				if rooms[i].id == requests.room and rooms[i].open and rooms[i].required_role <= me.role then
					sql.chat('UPDATE users SET chat_room = ' .. rooms[i].id .. ' WHERE id = ' .. session.user .. ';')
					online = true
				end
			end
		end
	end
end

function chatHTML()
	return template.parse(config.dir .. 'template/chat.html')
end

function lobbyHTML()
	local banHTML = function(banStr)
		if banned then
			return template.parse(banStr, {
				BAN_REMAINING = banned.expires - time,
				BANNED_BY = web.html_encode(banned.banned_by),
				BAN_REASON = web.html_encode(banned.reason)
			}, true)
		end
	end
	local roomHTML = function(roomStr)
		local userHTML = function(userStr, id)
			local s = ''
			for i = 1, #rooms[id].randomUsers do
				s = s .. template.parse(userStr, {
					USERNAME = rooms[id].randomUsers[i].name,
					ROLE = rooms[id].randomUsers[i].role,
					PHOTO = config.photoFormat:format(rooms[id].randomUsers[i].photo)
				}, true)
			end
			return s
		end
		local s = ''
		for i = 1, #rooms do
			if rooms[i].required_role <= me.role then
				s = s .. template.parse(roomStr, {
					TOKEN = session.token,
					ROOM_ID = rooms[i].id,
					ROOM_NAME = web.html_encode(rooms[i].name),
					REQUIRED_ROLE = rooms[i].required_role,
					USER_COUNT = rooms[i].users,
					USER = function(userStr)
						return userHTML(userStr, i)
					end
				}, true)
			end
		end
		return s
	end
	for i = 1, #rooms do
		rooms[i].randomUsers = sql.chat('SELECT name, role, photo FROM users WHERE chat_room = ' .. rooms[i].id .. ' ORDER BY RAND() LIMIT 5;').row
	end
	return template.parse(config.dir .. 'template/lobby.html', {
		TOKEN = session.token,
		USERNAME = web.html_encode(me.name),
		ONLINE_COUNT = online_count,
		IF_BANNED = banHTML,
		ROOMS = roomHTML
	})
end

function sendContent()
	ngx.header['Cache-Control'] = 'no-cache, must-revalidate'
	ngx.header['Expires'] = '0'
	ngx.header['Content-Type'] = 'text/html; charset=UTF-8'
	ngx.print(online and chatHTML() or lobbyHTML())
	ngx.eof()
end

function redirectToLogin()
	ngx.redirect('/', ngx.HTTP_MOVED_TEMPORARILY)
end

if initSession() then
	initRequests()
	initRooms()
	checkIfBanned()
	handleRequests()
	sendContent()
else
	redirectToLogin()
end