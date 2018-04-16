var regex_message_style = /^1[1-9]\|(?:[1-9]|[1-3][0-9]|4[0-6])?\|[A-F0-9]{6}\|[01]\|[01]\|[01]$/i;

function ChatRoom(id, name, open, required_role) {
	this.id = id;
	this.name = name;
	this.is_open = !!open;
	this.required_role = required_role;
	this.users = [];
	this.message_cache = [];
	chat.rooms_name[name.toLowerCase()] = chat.rooms[id] = this;
	chat.rooms_iterate.push(this);
}

ChatRoom.prototype.open = function() {
	if (!this.is_open) {
		this.is_open = true;
		var i, j;
		for (i = 0; i < chat.rooms_iterate.length; i++) {
			for (j = 0; j < chat.rooms_iterate[i].users.length; j++) chat.rooms_iterate[i].users[j].send_allowed_rooms();
		}
		query('UPDATE chat_rooms SET open = 1 WHERE id = ' + this.id + ';');
	}
}

ChatRoom.prototype.close = function() {
	if (this.is_open) {
		this.is_open = false;
		var i, j;
		for (i = 0; i < this.users.length; i++) this.users[i].kick(user_server, 'This room is now closed.');
		for (i = 0; i < chat.rooms_iterate.length; i++) {
			for (j = 0; j < chat.rooms_iterate[i].users.length; j++) chat.rooms_iterate[i].users[j].send_allowed_rooms();
		}
		query('UPDATE chat_rooms SET open = 0 WHERE id = ' + this.id + ';');
	}
}

ChatRoom.prototype.set_required_role = function(role) {
	for (var i = 0; i < this.users.length; i++) {
		if (this.users[i].role < role) this.users[i].kick(user_server, 'This room requires higher priveleges.');
	}
	this.role = role;
	query('UPDATE chat_rooms SET required_role = ' + role + ' WHERE id = ' + this.id + ';');
}

ChatRoom.prototype.send = function(data) {
	for (var i = 0; i < this.users.length; i++) this.users[i].send(data);
}

ChatRoom.prototype.cache_message = function(message) {
	if (this.message_cache.length >= config.room_message_cache_size) this.message_cache.shift();
	this.message_cache.push(message);
	chat.message_id++;
}

ChatRoom.prototype.server_message = function(message) {
	var data = { m: {
		i: chat.message_id,
		t: unix_time(),
		m: message
	} };
	this.cache_message(data.m);
	this.send(JSON.stringify(data))
}

ChatRoom.prototype.delete_message = function(msg_id) {
	for (var i = 0; i < this.message_cache.length; i++) {
		if (this.message_cache[i].i == msg_id) {
			this.message_cache.splice(i, 1);
			break;
		}
	}
	this.send(JSON.stringify({ s: '/delmsg ' + msg_id }));
}

ChatRoom.prototype.message = function(user, message, style) {
	if (message.length > config.room_max_message_length) message = message.substr(0, config.room_max_message_length);
	var data = { m: {
		i: chat.message_id,
		t: unix_time(),
		u: user.id,
		n: user.name,
		r: user.role,
		m: message
	} };
	if (style && regex_message_style.test(style)) data.m.s = style;
	this.cache_message(data.m);
	this.send(JSON.stringify(data));
}

ChatRoom.prototype.clear_message_cache = function() {
	this.message_cache.length = 0;
}

ChatRoom.prototype.get_user_list = function() {
	var i, user, data = [];
	for (i = 0; i < this.users.length; i++) {
		user = {
			i: this.users[i].id,
			n: this.users[i].name,
			r: this.users[i].role,
			p: this.users[i].photo,
		}
		if (this.users[i].muted) user.m = 1;
		if (this.users[i].typing) user.t = 1;
		if (this.users[i].away) user.a = this.users[i].away;
		data.push(user);
	}
	return data;
}

ChatRoom.prototype.get_user_names = function() {
	var users = [];
	for (i = 0; i < this.users.length; i++) users.push(this.users[i].name);
	return users;
}

ChatRoom.prototype.has_user = function(user) {
	for (var i = 0; i < this.users.length; i++) {
		if (this.users[i] == user) return true;
	}
}

ChatRoom.prototype.add_user = function(user, message, ws) {
	var do_message, data;
	if (!this.has_user(user)) {
		data = { u: {
			i: user.id,
			n: user.name,
			r: user.role,
			p: user.photo,
		} };
		if (user.muted) data.u.m = 1;
		if (user.typing) data.u.t = 1;
		if (user.away) data.u.a = user.away;
		this.send(JSON.stringify(data));
		this.users.push(user);
		do_message = !user.muted;
	}
	data = { i: {
		s: this.name,
		u: this.get_user_list()
	} };
	if (this.message_cache.length) data.i.m = this.message_cache;
	(ws || user).send(JSON.stringify(data));
	if (do_message && message) this.server_message(message);
}

ChatRoom.prototype.remove_user = function(user, message) {
	for (var i = 0; i < this.users.length; i++) {
		if (this.users[i] == user) this.users.splice(i, 1);
	}
	this.send(JSON.stringify({ u: {
		i: user.id,
		l: 1
	} }));
	if (message && !user.muted) this.server_message(message);
}

module.exports = ChatRoom;