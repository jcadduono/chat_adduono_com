print = function(s) { process.stdout.write('[' + new Date().toString().split(' ')[4] + '] ' + s + '\n'); }
unix_time = function() { return Date.now() / 1000 | 0; };

config = require('./config.js');
chat_role = config.chat_roles;
server_user = {
	id: 0,
	name: 'Server',
	role: 0
}

var chat_user = require('./lib/chatuser.js');
var chat_room = require('./lib/chatroom.js');
var handle_chat_command = require('./lib/chatcommands.js');
var cookie = require('./lib/cookie.js');
var ws_server = require('ws').Server;

print('Dropping to user ' + config.user + ' in group ' + config.group + '...');
try {
	process.setgid(config.group);
	process.setuid(config.user);
	print('Success!');
} catch (err) {
	print('Unable to set UID and GID. Exiting...');
	process.exit();
}

print('Creating MySQL pool...');
var mysql_pool = require('mysql').createPool({
	socketPath: config.mysql.socket,
	user: config.mysql.user,
	password: config.mysql.password,
	database: config.mysql.database,
	connectionLimit: config.mysql.connection_pool_limit
});

query = function(query, callback) { return mysql_pool.query(query, callback); }
safe = function(text) { return mysql_pool.escape(text); };

print('Creating chat instance...');

chat = {
	server: null,
	users: {},
	users_name: {},
	rooms: {},
	rooms_iterate: [],
	rooms_name: {},
	//bans: {},
	message_id: 1,

	run: function() {
		print('Creating chat server on ' + config.listen_socket + '...');
		process.umask(2);
		chat.server = new ws_server({ socket: config.listen_socket });
		print('Now listening for new connections.');
		chat.server.on('connection', chat.on_connect);
	},

	on_connect: function(ws) {
			print('New connection from ' + ws.upgradeReq.headers.ip);
			chat.authenticate_client(ws);
	},

	authenticate_client: function(ws) {
		var token = cookie.parse(ws.upgradeReq.headers.cookie)[config.cookie_name];
		if (cookie.validate_key(token)) {
			query('SELECT user FROM sessions WHERE (id = ' + safe(token) + ' AND expires > ' + unix_time() + ' AND logged_in = 1);', function(err, row) {
				if (err) throw err;
				if (row = row[0]) {
					query('SELECT * FROM users WHERE id = ' + row.user + ';', function(err, row) {
						if (err) throw err;
						if (row = row[0]) {
							if (chat.rooms[row.chat_room]) {
								var user;
								if (chat.users[row.id]) {
									user = chat.users[row.id];
								} else {
									user = new chat_user(row.id, row.name, row.chat_room, row.role, row.muted, row.photo);
								}
								print(ws.upgradeReq.headers.ip + ' authenticated as ' + user.name);
								user.open(ws);
								ws.on('message', function(data) {
									chat.handle_message(ws, user, JSON.parse(data));
								});
								ws.on('close', function() {
									user.close(ws);
								});
							} else { chat.send_to_lobby(ws); } // user is not in a room
						}
						else { chat.send_to_lobby(ws); } // user does not exist
					});
				} else { chat.send_to_lobby(ws); } // logged in user with cookie not found
			});
		} else { chat.send_to_lobby(ws); } // invalid cookie
	},

	handle_message: function(ws, user, data) {
		if (typeof data == 'string') {
		} else {
			if ('m' in data) {
				if ('t' in data.m) {
					user.set_typing(false);
					if (data.m.t[0] == '/') {
						var params = data.m.t.split(' '), cmd = params.splice(0, 1)[0].substr(1);
						handle_chat_command(user, cmd, params, ws);
					} else {
						user.message(data.m.t, data.m.s);
					}
				}
			}
			else if ('t' in data) {
				user.set_typing(data.t);
			}
		}
	},

	send: function(data) {
		chat.server.clients.forEach(function each(ws) {
			ws.send(data);
		});
	},

	server_message: function(message) {
		chat.send(JSON.stringify({ s: message }));
	},

	send_to_lobby: function(ws) {
		if (ws) {
			ws.send('{"i":{"q":1}}');
			ws.close();
		}
		else {
			chat.server.clients.forEach(function each(ws) {
				ws.send('{"i":{"q":1}}');
				ws.close();
			});
		}
	},

	close: function() {
		print('Closing chat server socket...');
		chat.server.close();
		print('Closing MySQL pool...');
		mysql_pool.end();
	}
};

process.on('SIGINT', function() {
	print('Shutting down...');
	chat.close();
});

print('Loading chat rooms...');
query('SELECT * FROM chat_rooms;', function(err, row) {
	if (err) throw err;
	for (var i = 0; i < row.length; i++) new chat_room(row[i].id, row[i].name, row[i].open, row[i].required_role);
	if (i) {
		print('Loaded ' + i + ' chat rooms.');
		chat.run();
	} else {
		print('No rooms were found! Exiting...');
		process.exit();
	}
});
/*
print('Loading ban list...');
query('SELECT * FROM chat_bans;', function(err, row) {
	if (err) throw err;
	for (var i = 0; i < row.length; i++) chat.bans[row.user] = row
	if (i) {
		print('Loaded ' + i + ' chat bans.');
	}
});
*/
