var regex_message_style = /^1[1-9]\|(?:[1-9]|[1-3][0-9]|4[0-6])?\|[A-F0-9]{6}\|[01]\|[01]\|[01]$/i;

function ChatUser(id, name, room, role, muted, photo) {
	this.id = id;
	this.name = name;
	this.room = chat.rooms[room];
	this.role = role;
	this.muted = !!muted;
	this.photo = photo;
	this.typing = false;
	this.away = false;
	this.ws = [];
	chat.users_name[name.toLowerCase()] = chat.users[id] = this;
}

ChatUser.prototype.send = function(data) {
	for (var i = 0; i < this.ws.length; i++) this.ws[i].send(data);
}

ChatUser.prototype.open = function(ws) {
	this.ws.push(ws);
	ws.send(JSON.stringify({ i: {
		i: this.id,
		n: this.name,
		r: this.role,
		o: this.get_allowed_rooms()
	} }));
	this.room.add_user(this, '/login ' + this.name, ws);
}

ChatUser.prototype.close = function(ws) {
	if (ws) {
		for (var i = 0; i < this.ws.length; i++) {
			if (this.ws[i] == ws) {
				this.ws.splice(i, 1);
				break;
			}
		}
		if (!this.ws.length && chat.users[this.id]) this.timeout();
	}
	else {
		for (var i = 0; i < this.ws.length; i++) this.ws[i].close();
		this.ws.length = 0;
	}
}

ChatUser.prototype.quit = function() {
	this.send('{"i":{"q":1}}');
	this.room.remove_user(this, '/quit ' + this.name);
	query('UPDATE users SET chat_room = 0 WHERE id = ' + this.id + ';');
	this.destroy();
}

ChatUser.prototype.timeout = function() {
	this.room.remove_user(this, '/timeout ' + this.name);
	query('UPDATE users SET chat_room = 0 WHERE id = ' + this.id + ';');
	this.destroy();
}

ChatUser.prototype.kick = function(user_by, msg) {
	msg = msg || 'Removed from chat';
	this.send(JSON.stringify({ i: {
		k: {
			u: user_by.name,
			r: msg
		}
	} }));
	this.room.remove_user(this, '/kick ' + this.name + ' ' + user_by.name + ' ' + msg);
	query('UPDATE users SET chat_room = 0 WHERE id = ' + this.id + ';');
	this.destroy();
}

ChatUser.prototype.mute = function(user_by) {
	if (!this.muted) {
		this.muted = true;
		this.room.send(JSON.stringify({ u: {
			i: this.id,
			m: 1
		} }));
		this.room.server_message('/mute ' + this.name + ' ' + user_by.name);
		query('UPDATE users SET muted = 1 WHERE id = ' + this.id + ';');
	}
}

ChatUser.prototype.unmute = function(user_by) {
	if (this.muted) {
		this.muted = false;
		this.room.send(JSON.stringify({ u: {
			i: this.id,
			m: 0
		} }));
		this.room.server_message('/unmute ' + this.name + ' ' + user_by.name);
		query('UPDATE users SET muted = 0 WHERE id = ' + this.id + ';');
	}
}

ChatUser.prototype.set_away = function(message) {
	var data = { u: { i: this.id } };
	if (message) {
		this.away = message.substr(0, config.room_max_message_length);
		data.u.a = this.away;
		if (!this.muted) this.room.server_message('/away ' + this.name + ' ' + this.away);
	}
	else if (!this.away) {
		this.away = true;
		data.u.a = 1;
		if (!this.muted) this.room.server_message('/away ' + this.name);
	}
	else {
		this.away = false;
		data.u.a = 0;
		if (!this.muted) this.room.server_message('/back ' + this.name);
	}
	this.room.send(JSON.stringify(data));
}

ChatUser.prototype.set_typing = function(typing) {
	if (this.typing != typing) {
		this.typing = !!typing;
		this.room.send(JSON.stringify({ u: {
			i: this.id,
			t: this.typing ? 1 : 0
		} }));
	}
}

ChatUser.prototype.server_message = function(message) {
	this.send(JSON.stringify({ s: message }));
}

ChatUser.prototype.go = function(room) {
	if (room != this.room && room.is_open) {
		this.room.remove_user(this, '/move ' + this.name + ' ' + room.name);
		this.room = room;
		room.add_user(this, '/enter ' + this.name);
		query('UPDATE users SET chat_room = ' + room.id + ' WHERE id = ' + this.id + ';');
	}
}

ChatUser.prototype.message = function(message, style) {
	if (!this.muted) this.room.message(this, message, style)
	else this.server_message('/error Muted');
}

ChatUser.prototype.query = function(user, message, style) {
	if (message.length > config.query_max_message_length) message = message.substr(0, config.query_max_message_length);
	var data = { p: {
		t: unix_time(),
		q: user.id,
		u: this.id,
		n: this.name,
		r: this.role,
		m: message
	} };
	if (style && regex_message_style.test(style)) data.m[0].s = style;
	data = JSON.stringify(data);
	this.send(data)
	if (this != user) user.send(data);
}

ChatUser.prototype.get_allowed_rooms = function() {
	var rooms = []
	for (var i = 0; i < chat.rooms_iterate.length; i++) {
		if (chat.rooms_iterate[i].is_open && this.role >= chat.rooms_iterate[i].required_role) rooms.push(chat.rooms_iterate[i].name);
	}
	return rooms;
}

ChatUser.prototype.send_allowed_rooms = function() {
	this.send(JSON.stringify({ i: {
		o: this.get_allowed_rooms()
	} }));
}

ChatUser.prototype.destroy = function() {
	delete chat.users[this.id];
	delete chat.users_name[this.name.toLowerCase()];
	this.close();
}

module.exports = ChatUser;