function room_from_room_name(room_name) {
	return chat.rooms_name[room_name.toLowerCase()];
}

function user_from_user_name(user_name) {
	return chat.users_name[user_name.toLowerCase()];
}

function handle_go(user, room_name) {
	if (room_name) {
		var room = room_from_room_name(room_name);
		if (room) {
			if (room.open) {
				if (user.role >= room.required_role) {
					user.go(room);
				}
				else { user.server_message('/error RoomNotAllowed ' + room.name); }
			}
			else { user.server_message('/error RoomClosed ' + room.name); }
		}
		else { user.server_message('/error InvalidRoomName ' + room_name); }
	}
	else { user.server_message('/error MissingRoomName'); }
}

function handle_kick(user, params) {
	if (user.role >= chat_role.host) {
		if (params.length) {
			var user_kick = user_from_user_name(params[0]);
			if (user_kick) {
				if (user.role > user_kick.role) {
					user_kick.kick(user, params.slice(1).join(' '));
				}	
				else { user.server_message('/error KickNotAllowed ' + user_kick.name); }
			}
			else { user.server_message('/error UserNameNotFound ' + params[0]); }
		}
		else { user.server_message('/error MissingUserName'); }
	}
	else { user.server_message('/error CommandNotAllowed kick'); }
}

function handle_mute(user, user_name) {
	if (user.role >= chat_role.host) {
		if (user_name) {
			var user_mute = user_from_user_name(user_name);
			if (user_mute) {
				if (user.role > user_mute.role) {
					if (!user_mute.muted) {
						user_mute.mute(user);
					}
					else { user.server_message('/error AlreadyMuted ' + user_mute.name); }
				}	
				else { user.server_message('/error MuteNotAllowed ' + user_mute.name); }
			}
			else { user.server_message('/error UserNameNotFound ' + user_name); }
		}
		else { user.server_message('/error MissingUserName'); }
	}
	else { user.server_message('/error CommandNotAllowed mute'); }
}

function handle_unmute(user, user_name) {
	if (user.role >= chat_role.host) {
		if (user_name) {
			var user_mute = user_from_user_name(user_name);
			if (user_mute) {
				if (user.role > user_mute.role) {
					if (user_mute.muted) {
						user_mute.unmute(user);
					}
					else { user.server_message('/error NotMuted ' + user_mute.name); }
				}	
				else { user.server_message('/error UnmuteNotAllowed ' + user_mute.name); }
			}
			else { user.server_message('/error UserNameNotFound ' + user_name); }
		}
		else { user.server_message('/error MissingUserName'); }
	}
	else { user.server_message('/error CommandNotAllowed unmute'); }
}

function handle_delmsg(user, msg_id) {
	if (user.role >= chat_role.host) {
		if (msg_id > 0 && msg_id <= chat.message_id) {
			user.room.delete_message(msg_id);
		}
	}
	else { user.server_message('/error CommandNotAllowed delmsg'); }
}

function handle_away(user, message) {
	user.set_away(message);
}

function handle_who(user, room_name) {
	if (room_name.length) {
		var room = room_from_room_name(room_name);
		if (room) {
			if (room.open) {
				if (user.role >= room.required_role) {
					user.server_message('/whoroom ' + room.name + '|' + room.get_user_names().join(' '));
				}
				else { user.server_message('/error RoomNotAllowed ' + room.name); }
			}
			else { user.server_message('/error RoomClosed ' + room.name); }
		}
		else { user.server_message('/error InvalidRoomName ' + room_name); }
	}
	else {
		var users = '';
		for (var i = 0; i < chat.rooms_iterate.length; i++) {
			if (chat.rooms_iterate[i].is_open && user.role >= chat.rooms_iterate[i].required_role && chat.rooms_iterate[i].users.length)
				users += ' ' + chat.rooms_iterate[i].get_user_names().join(' ');
		}
		user.server_message('/who' + users)
	}
}

function handle_list(user) {
	user.server_message('/list ' + user.get_allowed_rooms().join('|'));
}

function handle_eval(user, commands) {
	if (user.role >= chat_role.owner) {
		print(user.name + ' performed eval: ' + commands);
		try { eval(commands); }
		catch (e) {}
	}
	else { user.server_message('/error CommandNotAllowed eval'); }
}

module.exports = function(user, cmd, params) {
	switch (cmd) {
		case 'quit':
		case 'leave':
		case 'exit':
			user.quit();
			break;
		case 'go':
		case 'move':
		case 'join':
			handle_go(user, params.join(' '));
			break;
		case 'kick':
		case 'k':
			handle_kick(user, params);
			break;
		case 'mute':
		case 'm':
			handle_mute(user, params[0]);
			break;
		case 'unmute':
		case 'um':
			handle_unmute(user, params[0]);
			break;
		case 'delmsg':
			handle_delmsg(user, parseInt(params[0]));
			break;
		case 'away':
		case 'afk':
		case 'brb':
		case 'back':
			handle_away(user, params.join(' '));
			break;
		case 'who':
			handle_who(user, params.join(' '));
			break;
		case 'list':
			handle_list(user);
			break;
		case 'eval':
		case 'run':
			handle_eval(user, params.join(' '));
			break;
		default:
			user.server_message('/error UnknownCommand ' + cmd);
	}
}