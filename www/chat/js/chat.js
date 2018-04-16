var chat = {
	tabs: new ChatTabs(),
	originalTitle: document.title,
	blinkState: 0,

	run: function() {
		chat.loadSavedSettings();
		window.onload = function() {
			chat.initialize();
		}
		window.onbeforeunload = function() {
			chat.finalize();
		}
	},

	loadSavedSettings: function() {
		if ('localStorage' in window) {
			if (chat.storageName in window.localStorage) {
				chat.settings = JSON.parse(window.localStorage[chat.storageName]);
				return;
			}
		}
		chat.settings = chat.defaultSettings;
	},

	setSetting: function(key, value) {
		chat.settings[key] = value;
		chat.focusInput();
	},

	updateInputFieldStyle: function(fs) {
		chat.dom.inputField.style.fontSize = fs.size + 'px';
		chat.dom.inputField.style.color = '#' + fs.color;
		var ifc = ['font' + fs.family];
		if (fs.b) ifc.push('b');
		if (fs.i) ifc.push('i');
		if (fs.u) ifc.push('u');
		chat.dom.inputField.className = ifc.join(' ');
	},

	updateFontStyle: function() {
		chat.setSetting('fontStyle', document.getElementById('fontPersistSizeSetting').value + '|'
			+ (document.getElementById('fontPersistFontSetting').selectedIndex + 1) + '|'
			+ document.getElementById('fontPersistColorSetting').value + '|'
			+ (document.getElementById('fontPersistBoldSetting').checked ? 1 : 0) + '|'
			+ (document.getElementById('fontPersistItalicSetting').checked ? 1 : 0) + '|'
			+ (document.getElementById('fontPersistUnderlineSetting').checked ? 1 : 0));
		chat.updateInputFieldStyle(parseFontStyleString(chat.settings.fontStyle));
	},

	fillSettings: function() {
		var fontStyle = parseFontStyleString(chat.settings.fontStyle);
		chat.updateInputFieldStyle(fontStyle);
		document.getElementById('fontPersistSizeSetting').selectedIndex = fontStyle.size - 11;
		document.getElementById('fontPersistFontSetting').selectedIndex = fontStyle.family - 1;
		document.getElementById('fontPersistColorSetting').color.fromString(fontStyle.color);
		document.getElementById('fontPersistBoldSetting').checked = fontStyle.b;
		document.getElementById('fontPersistItalicSetting').checked = fontStyle.i;
		document.getElementById('fontPersistUnderlineSetting').checked = fontStyle.u;
		document.getElementById('bbCodeSetting').checked = chat.settings.bbCode;
		document.getElementById('timeStampsSetting').checked = chat.settings.timeStamps;
		document.getElementById('fontStylesSetting').checked = chat.settings.fontStyles;
		document.getElementById('hyperLinksSetting').checked = chat.settings.hyperLinks;
		document.getElementById('imagesSetting').checked = chat.settings.images;
		document.getElementById('youTubeSetting').checked = chat.settings.youTube;
		document.getElementById('lineBreaksSetting').checked = chat.settings.lineBreaks;
		document.getElementById('emoticonsSetting').checked = chat.settings.emoticons;
		document.getElementById('autoFocusSetting').checked = chat.settings.autoFocus;
		document.getElementById('showTypingSetting').checked = chat.settings.showTyping;
		document.getElementById('maxMessagesSetting').value = chat.settings.maxMessages;
		document.getElementById('dateFormatSetting').value = chat.settings.dateFormat;
		document.getElementById('blinkSetting').checked = chat.settings.blink;
		document.getElementById('blinkIntervalSetting').value = chat.settings.blinkInterval;
		document.getElementById('blinkIntervalNumberSetting').value = chat.settings.blinkIntervalNumber;
		for (var i = 0; i < document.getElementById('soundVolumeSetting').options.length; i++) {
			if (document.getElementById('soundVolumeSetting').options[i].value == chat.settings.soundVolume) {
				document.getElementById('soundVolumeSetting').options[i].selected = true;
				break;
			}
		}
		chat.fillSoundSelection('soundReceiveSetting', chat.settings.soundReceive);
		chat.fillSoundSelection('soundSendSetting', chat.settings.soundSend);
		chat.fillSoundSelection('soundEnterSetting', chat.settings.soundEnter);
		chat.fillSoundSelection('soundLeaveSetting', chat.settings.soundLeave);
		chat.fillSoundSelection('soundServerSetting', chat.settings.soundServer);
		chat.fillSoundSelection('soundErrorSetting', chat.settings.soundError);
		chat.updateButton('sound', 'toggleSound');
		chat.updateButton('autoScroll', 'toggleAutoscroll');
	},

	initialize: function() {
		chat.initDOMNodes();
		chat.initSounds();	
		chat.initEmoticons();
		chat.initColorCodes();
		chat.fillSettings();
		chat.updateMessageLength();
		chat.focusInput();
		chat.connect();
	},
	
	finalize: function() {
		chat.closing = true;
		if (chat.socket && chat.socket.readyState == 1) {
			chat.sendMessage('/quit');
			chat.socket.close();
		}
		if ('localStorage' in window) window.localStorage[chat.storageName] = JSON.stringify(chat.settings);
	},
	
	connect: function() {
		var loc = window.location;
		chat.socket = new WebSocket((loc.protocol == 'https:' ? 'wss:' : 'ws:') + '//' + loc.host + loc.pathname + 'connect');
		chat.socket.onopen = function(e){ chat.handleSocketOpen(e) };
		chat.socket.onclose = function(e){ chat.handleSocketClose(e) };
		chat.socket.onmessage = function(e){ chat.handleResponse(e) };
	},
	
	handleSocketOpen: function() {
		clearTimeout(chat.retryTimer);
		chat.restartPingTimer();
	},
	
	reconnect: function() {
		chat.addServerMessage('/error ConnectionStatus Reconnecting...');
		chat.connect();
	},
	
	handleSocketClose: function(e) {
		if (!chat.closing) {
			chat.addServerMessage('/error ConnectionStatus Socket Closed: ' + e.code + ' (' + e.reason + ')');
			clearTimeout(chat.pingTimer);
			clearTimeout(chat.retryTimer);
			chat.retryTimer = setTimeout(chat.reconnect, 3000);
		}
	},
	
	restartPingTimer: function() {
		clearTimeout(chat.pingTimer);
		chat.pingTimer = setTimeout(chat.ping, 40000);
	},
	
	ping: function() {
		chat.makeRequest('p');
	},

	initDOMNodes: function() {
		chat.dom = {};
		for (var key in chat.domIDs) chat.dom[key] = document.getElementById(chat.domIDs[key]);
	},

	initEmoticons: function() {
		var emote, onclick = function() {
				chat.insert(this.title);
				showHide('emoticonsBorder');
		}
		for (var e in chat.emoticons) {
			emote = document.createElement('img');
			emote.src = 'img/emoticons/' + chat.emoticons[e]
			emote.title = e;
			emote.alt = e;
			emote.onclick = onclick;
			chat.dom.emoticons.appendChild(emote);
		}
	},

	initColorCodes: function() {
		var color, onclick = function() {
			chat.insert('[color=' + this.title + ']', '[/color]');
			showHide('colors');
		}
		for (var c in chat.colorCodes) {
			color = document.createElement('span');
			color.title = chat.colorCodes[c];
			color.style.backgroundColor = chat.colorCodes[c];
			color.onclick = onclick;
			chat.dom.colors.appendChild(color);
		}
	},

	setSoundVolume: function(volume) {
		chat.setSetting('soundVolume', +volume);
		for (var type in chat.sounds) chat.sounds[type].volume = +volume;
	},
	
	setSound: function(type, name) {
		chat.setSetting('sound' + type, name);
		if (name in chat.soundFiles) {
			chat.sounds[type].src = 'sounds/' + chat.soundFiles[name] + (chat.sounds[type].canPlayType('audio/ogg; codecs="vorbis"') ? '.ogg' : '.mp4');
		}
	},

	initSounds: function() {
		chat.sounds = {};
		chat.sounds.Receive = new Audio();
		chat.sounds.Send = new Audio();
		chat.sounds.Enter = new Audio();
		chat.sounds.Leave = new Audio();
		chat.sounds.Server = new Audio();
		chat.sounds.Error = new Audio();
		for (var type in chat.sounds) {
			chat.setSound(type, chat.settings['sound' + type]);
			chat.sounds[type].preload = 'auto';
			chat.sounds[type].volume = chat.settings.soundVolume;
		}
	},

	playSound: function(type) {
		if (type in chat.sounds && chat.sounds[type].currentSrc != '-') {
			try {
				chat.sounds[type].currentTime = 0;
			}
			catch (e) {
				chat.sounds[type].load();
			}
			chat.sounds[type].play();
		}
	},

	fillSoundSelection: function(selectionID, selectedSound) {
		var selection = document.getElementById(selectionID);
		var i = 1;
		for (var key in chat.soundFiles) {
			selection.options[i] = new Option(key, key);
			if (key == selectedSound) selection.options[i].selected = true;
			i++;
		}
	},

	makeRequest: function(data) {
		if (chat.socket.readyState == 1) {
			data = JSON.stringify(data);
			chat.socket.send(data);
			console.log('sent: ' + data);
			chat.restartPingTimer();
		} else {
			chat.addServerMessage('/error ConnectionStatus Not Ready');
		}
	},
	
	handleResponse: function(re) {
		try {
			console.log('rec: ' + re.data);
			var data = JSON.parse(re.data);
			try {
				if ('i' in data) chat.handleInfoMessages(data.i);
				if ('u' in data) chat.handleUserUpdate(data.u);
				if ('s' in data) chat.addServerMessage(data.s);
				if ('m' in data) chat.handleChatMessage(data.m);
				if ('p' in data) chat.handlePrivateMessage(data.p);
			} catch (e) {
				chat.addServerMessage('/error JSSyntax ' + e.message);
			}
		} catch (e) {
			chat.addServerMessage('/error JSON ' + re.data);
		}
		return true;
	},

	handleInfoMessages: function(infos) {
		if ('o' in infos) chat.updateRoomOptions(infos.o);
		if ('i' in infos) chat.userID = infos.i;
		if ('n' in infos) chat.userName = infos.n;
		if ('r' in infos) chat.userRole = infos.r;
		if ('s' in infos) chat.setSelectedRoom(infos.s);
		if ('u' in infos) chat.handleEntryUsers(infos.u);
		if ('m' in infos) chat.handleEntryMessages(infos.m);
		if ('k' in infos) chat.handleKicked(infos.k);
		if ('b' in infos) chat.handleBanned(infos.b);
		if ('q' in infos) chat.handleLobby();
	},
	
	handleEntryUsers: function(users) {
		chat.userList = new UserList();
		for (var i = 0; i < users.length; i++) {
			chat.userList.add(new ChatUser(
				users[i].i,
				users[i].n,
				users[i].r,
				users[i].p,
				'm' in users[i],
				't' in users[i],
				'a' in users[i] ? users[i].a : false
			));
		}
		chat.userList.sort();
	},
	
	handleEntryMessages: function(messages) {
		if (!chat.tabs.active) chat.tabs.openRoom('Status');
		var msg, tab = chat.tabs.getFirstRoom();
		for (var i = 0; i < messages.length; i++) {
			if ('u' in messages[i]) {
				if (!chat.ignoreMessage(messages[i].n) && (msg = replaceText(messages[i].m))) tab.addMessage(new Date(messages[i].t * 1000), messages[i].u, messages[i].n, messages[i].r, messages[i].i, 's' in messages[i] ? messages[i].s : null, msg);
			}
			else if (msg = chat.parseCommands(messages[i].m)) tab.addMessage(new Date(messages[i].t * 1000), 0, null, 0, messages[i].i, null, msg);
		}
	},

	handleUserUpdate: function(user) {
		var listUser, sort = false;
		if (listUser = chat.userList.get(user.i)) {
			if ('l' in user) {
				chat.userList.remove(user.i);
				sort = true;
			} else {
				if ('n' in user) {
					listUser.setName(user.n);
					sort = true;
				}
				if ('r' in user) {
					listUser.setRole(user.r);
					sort = true;
				}
				if ('p' in user) listUser.setPhoto(user.p);
				if ('m' in user) listUser.setMuted(user.m);
				if ('t' in user) listUser.setTyping(user.t);
				if ('a' in user) listUser.setAway(user.a);
			}
		}
		else {
			chat.userList.add(new ChatUser(
				user.i,
				user.n,
				user.r,
				user.p,
				'm' in user,
				't' in user,
				'a' in user ? user.a : false
			));
			sort = true;
		}
		if (sort) chat.userList.sort();
	},

	handleChatMessage: function(message) {
		if (!chat.tabs.active) chat.tabs.openRoom('Status');
		if ('u' in message) {
			if (chat.ignoreMessage(message.n)) return;
			var msg = replaceText(message.m);
			if (msg.length) {
				chat.tabs.getFirstRoom().addMessage(new Date(message.t * 1000), message.u, message.n, message.r, message.i, 's' in message ? message.s : null, msg);
				chat.notifyMessage(message.n);
			}
		}
		else {
			var msg = chat.parseCommands(message.m);
			if (msg.length) {
				chat.tabs.getFirstRoom().addMessage(new Date(message.t * 1000), 0, null, 0, message.i, null, msg);
				chat.notifyMessage(null, message.m);
			}
		}
	},
	
	handlePrivateMessage: function(message) {
		if (!chat.ignoreMessage(message.n)) {
			var msg = replaceText(message.m);
			if (msg.length) {
				chat.tabs.getQuery(message.q).addMessage(new Date(message.t * 1000), message.u, message.n, message.r, null, 's' in message ? message.s : null, msg);
				chat.notifyMessage(message.n);
			}
		}
	},
	
	updateRoomOptions: function(rooms) {
		var room, i, currentRoom = chat.tabs.getFirstRoom();
		while (chat.dom.room.hasChildNodes()) chat.dom.room.removeChild(chat.dom.room.firstChild);
		for (i = 0; i < rooms.length; i++) {
			room = document.createElement('option');
			room.appendChild(document.createTextNode(rooms[i]));
			room.value = rooms[i];
			if (currentRoom && rooms[i] == currentRoom.name) room.selected = true;
			chat.dom.room.appendChild(room);
		}
	},

	setSelectedRoom: function(room) {
		var i, selectedRoom;
		for (var i = 0; i < chat.dom.room.options.length; i++) {
			if (chat.dom.room.options[i].value == room) {
				chat.dom.room.options[i].selected = true;
				selectedRoom = true;
				break;
			}
		}
		if (!selectedRoom) {
			var option = document.createElement('option');
			option.appendChild(document.createTextNode(room));
			option.value = room;
			option.selected = true;
			chat.dom.room.appendChild(option);
		}
		if (chat.tabs.getFirstRoom()) chat.tabs.closeRoom(chat.tabs.getFirstRoom().name);
		chat.tabs.openRoom(room);
	},

	toggleUserMenu: function(userID, expand, scroll) {
		var listUser = chat.userList.get(userID)
		if (listUser) {
			listUser.setExpanded(!listUser.expanded || expand);
			if (scroll) chat.dom.onlineList.scrollTop = document.getElementById('u_' + userID).offsetTop;
		}
		chat.focusInput();
	},

	addServerMessage: function(message) {
		var msg = chat.parseCommands(message)
		if (msg.length) {
			if (!chat.tabs.active) chat.tabs.openRoom('Status');
			chat.tabs.active.addMessage(new Date(), 0, null, 0, null, null, msg);
			chat.notifyMessage(null, message);
		}
	},

	notifyMessage: function(name, message) {
		if (chat.settings.blink && name != chat.userName) {
			chat.blinkName = name;
			chat.blinkState = 0;
			clearInterval(chat.blinkInterval);
			chat.blinkInterval = setInterval(chat.blinkUpdate, chat.settings.blinkInterval);
			chat.blinkUpdate();
		}
		if (chat.settings.sound) {
			switch (name) {
				case null:
					switch (message.split(' ', 1)[0]) {
						case '/login':
						case '/enter':
							chat.playSound(chat.settings.soundEnter);
							break;
						case '/quit':
						case '/timeout':
						case '/move':
						case '/kick':
						case '/ban':
							chat.playSound(chat.settings.soundLeave);
							break;
						case '/error':
							chat.playSound(chat.settings.soundError);
							break;
						default:
							chat.playSound(chat.settings.soundServer);
					}
					break;
				case chat.userName:
					chat.playSound(chat.settings.soundSend);
					break;
				default:
					chat.playSound(chat.settings.soundReceive);
					break;
			}
		}
	},

	blinkUpdate: function() {
		var blinkStr = chat.blinkName ? chat.blinkName + ' - ' : '';
		if (!chat.blinkState) {
			document.title = '[\u25AC] ' + blinkStr + chat.originalTitle;
			chat.blinkState = 1;
		} else if (chat.blinkState > chat.settings.blinkIntervalNumber) {
			clearInterval(chat.blinkInterval);
			document.title = chat.originalTitle;
			chat.blinkState = 0;
		} else {
			if (chat.blinkState % 2 != 0) document.title = '[\u00A0\u00A0\u00A0\u00A0] ' + blinkStr + chat.originalTitle;
			else document.title = '[\u25AC] '+ blinkStr + chat.originalTitle;
			chat.blinkState++;
		}
	},

	completeName: function (s) {
		for (var i = 0; i < chat.userList.users.length; i++) if (chat.userList.users[i].name.toLowerCase().indexOf(s.toLowerCase()) == 0) return chat.userList.users[i].name;
		return false;
	},

	autoTabComplete: function() {
		var input = chat.dom.inputField;
		var wpos = getWordStartPos(input.value, input.selectionStart);
		var wposend = getWordEndPos(input.value, input.selectionStart);
		if (wpos != wposend) {
			var completedWord = chat.completeName(input.value.slice(wpos, input.selectionStart));
			if (completedWord) {
				if (input.selectionStart == input.value.length) completedWord += ' ';
				input.value = input.value.substring(0, wpos) + completedWord + input.value.substring(wposend);
				input.selectionStart = wpos + completedWord.length;
				input.selectionEnd = wpos + completedWord.length;
			}
		}
	},

	handleInputFieldKeyPress: function(event) {
		event = event || window.event;
		if (event.keyCode == 13 && !event.shiftKey) {
			chat.sendMessage(null, true);
			try { event.preventDefault(); }
			catch(e) { event.returnValue = false; }
			return false;
		}
		return true;
	},
	
	setTyping: function(typing) {
		if (chat.typing && !typing) {
			clearTimeout(chat.typingTimer);
			chat.typing = false;
			chat.makeRequest({ t: 0 });
		}
		else if (typing && chat.settings.showTyping) {
			clearTimeout(chat.typingTimer);
			chat.typingTimer = setTimeout(chat.setTyping, 1500);
			if (!chat.typing) {
				chat.typing = true;
				chat.makeRequest({ t: 1 });
			}
		}
	},

	handleInputFieldEdit: function(event) {
		chat.setTyping(!!chat.dom.inputField.value.length);
		chat.updateMessageLength();
	},

	handleInputFieldKeyDown: function(event) {
		event = event || window.event;
		if (event.keyCode == 9) {
			chat.autoTabComplete();
			try { event.preventDefault(); }
			catch(e) { event.returnValue = false; }
			return false;
		}
		else if (event.keyCode == 66 && event.ctrlKey) {
			chat.insertBBCode('b');
			try { event.preventDefault(); }
			catch(e) { event.returnValue = false; }
			return false;
		}
		else if (event.keyCode == 73 && event.ctrlKey) {
			chat.insertBBCode('i');
			try { event.preventDefault(); }
			catch(e) { event.returnValue = false; }
			return false;
		}
		else if (event.keyCode == 85 && event.ctrlKey) {
			chat.insertBBCode('u');
			try { event.preventDefault(); }
			catch(e) { event.returnValue = false; }
			return false;
		}
		return true;
	},
	
	focusInput: function() {
		if (chat.dom.inputField && chat.settings.autoFocus) chat.dom.inputField.focus();
	},

	updateMessageLength: function() {
		if (chat.dom.messageLength) chat.dom.messageLength.textContent = chat.dom.inputField.value.length + '/' + chat.messageLengthMax;
	},

	sendMessage: function(text, clear) {
		text = text !== undefined && text !== null ? text : chat.dom.inputField.value;
		if (clear) chat.dom.inputField.value = '';
		chat.focusInput();
		if (!text) return;
		text = chat.parseInputMessage(text);
		if (text) {
			chat.typing = false;
			clearTimeout(chat.typingTimer);
			chat.makeRequest({ m: { s: chat.settings.fontStyle, t: text } });
		}
		else chat.setTyping(false);
		chat.updateMessageLength();
	},

	parseInputMessage: function(text) {
		if (text[0] == '/') {
			var params = text.split(' '), cmd = params.splice(0, 1)[0];
			switch (cmd) {
				case '/ignore':
				case '/ignored':
				case '/unignore':
					chat.handleIgnoreCommand(params);
					return;
				case '/clear':
				case '/cls':
					chat.tabs.active.clearMessages();
					return;
				case '/pm':
				case '/query':
					if (params.length) {
						chat.tabs.openQuery(params[0]);
						if (chat.userList.get(params[0])) chat.userList.get(params[0]).updateMenu();
					}
					else chat.addServerMessage('/error MissingUserName');
					return;
				case '/cpm':
				case '/cq':
				case '/closepm':
				case '/closequery':
					if (params.length) {
						chat.tabs.closeQuery(params[0]);
						if (chat.userList.get(params[0])) chat.userList.get(params[0]).updateMenu();
					}
					else chat.addServerMessage('/error MissingUserName');
					return;
				case '/me':
				case '/do':
				case '/action':
					if (chat.tabs.active.type == 'query') return '/describe ' + chat.tabs.active.name + ' ' + params.join(' ');
			}
		}
		else if (chat.tabs.active.type == 'query') return '/msg ' + chat.tabs.active.name + ' ' + text;
		return text;
	},

	handleIgnoreCommand: function(params) {
		var ignored = chat.settings.ignoredNames;
		if (params.length) {
			var user = chat.userList.get(params[0]);
			var name = user ? user.name : htmlEncode(params[0]);
			if (ignored.length) {
				for (var i = 0; i < ignored.length; i++) {
					if (ignored[i].toLowerCase() == name.toLowerCase()) {
						chat.addServerMessage('/ignore- ' + ignored.splice(i, 1));
						if (user) user.setIgnored(false);
						return;
					}
				}
			}
			ignored.push(name);
			chat.addServerMessage('/ignore+ ' + name);
			if (user) user.setIgnored(true);
		} else {
			chat.addServerMessage('/ignored ' + ignored.join(' '))
		}
	},

	ignoreMessage: function(name) {
		return inArrayCI(chat.settings.ignoredNames, name);
	},

	deleteMessage: function(messageID) {
		if (confirm(lang('deleteMessageConfirm'))) chat.sendMessage('/delmsg ' + messageID);
	},

	switchRoom: function(room) {
		chat.sendMessage('/go ' + room)
		chat.focusInput();
	},

	goToLobby: function() {
		if (chat.socket && chat.socket.readyState == 1) {
			chat.sendMessage('/quit');
		} else {
			chat.closing = true;
			window.location.href = '../';
		}
	},

	handleLobby: function() {
		chat.closing = true;
		window.location.href = './';
	},

	handleKicked: function(info) {
		chat.closing = true;
		chat.socket.close();
		alert(lang('alertKicked', info.u, info.r));
		chat.handleLobby();
	},

	handleBanned: function(info) {
		chat.closing = true;
		chat.socket.close();
		alert(lang('alertBanned', info.b, formDurationString(info.t), info.r));
		chat.handleLobby();
	},

	updateAutoScroll: function() {
		if (chat.settings.autoScroll) {
			for (var i = 0; i < chat.tabs.tabs.length; i++) {
				chat.tabs.tabs[i].scroll();
			}
		}
	},

	toggleSetting: function(setting, buttonID) {
		chat.setSetting(setting, !chat.settings[setting]);
		if (buttonID) chat.updateButton(setting, buttonID);
		if (setting == 'autoScroll') chat.updateAutoScroll();
		chat.focusInput();
	},

	updateButton: function(setting, buttonID) {
		var node = document.getElementById(buttonID);
		if (node) node.className = chat.settings[setting] ? '' : 'off';
	},
	
	setMessage: function(text) {
		chat.dom.inputField.value = text;
		chat.dom.inputField.selectionStart = text.length;
		chat.dom.inputField.selectionEnd = text.length;
		chat.focusInput();
		chat.updateMessageLength();
	},

	insertBBCode: function(bbCode) {
		chat.insert('[' + bbCode + ']', '[/' + bbCode + ']');
	},

	insert: function(startTag, endTag) {
		if (!endTag) endTag = '';
		if (typeof document.selection != 'undefined') {
			var range = document.selection.createRange();
			var insText = range.text;
			range.text = startTag + insText + endTag;
			range = document.selection.createRange();
			if (insText.length == 0) range.move('character', -endTag.length);
			else range.moveStart('character', startTag.length + insText.length + endTag.length);
			range.select();
		}
		else if (typeof chat.dom.inputField.selectionStart != 'undefined') {
			var start = chat.dom.inputField.selectionStart;
			var end = chat.dom.inputField.selectionEnd;
			var insText = chat.dom.inputField.value.substring(start, end);
			chat.dom.inputField.value = chat.dom.inputField.value.substr(0, start) + startTag + insText + endTag + chat.dom.inputField.value.substr(end);
			var pos;
			if (insText.length == 0) pos = start + startTag.length;
			else pos = start + startTag.length + insText.length + endTag.length;
			chat.dom.inputField.selectionStart = pos;
			chat.dom.inputField.selectionEnd = pos;
		}
		else {
			var pos = chat.dom.inputField.value.length;
			chat.dom.inputField.value = chat.dom.inputField.value.substr(0, pos) + startTag + endTag + chat.dom.inputField.value.substr(pos);
		}
		chat.focusInput();
		chat.updateMessageLength();
	},

	parseCommands: function(text) {
		if (text[0] == '/') {
			var params = text.split(' '), cmd = params.splice(0, 1)[0].substr(1);
			switch (cmd) {
				case 'login':
					return chat.parseCommand.login(params);
				case 'quit':
					return chat.parseCommand.quit(params);
				case 'timeout':
					return chat.parseCommand.timeout(params);
				case 'enter':
					return chat.parseCommand.roomEnter(params);
				case 'move':
					return chat.parseCommand.roomMove(params);
				case 'topic':
					return chat.parseCommand.topic(params);
				case 'away':
					return chat.parseCommand.away(params);
				case 'back':
					return chat.parseCommand.back(params);
				case 'ignore+':
					return chat.parseCommand.ignoreAdded(params);
				case 'ignore-':
					return chat.parseCommand.ignoreRemoved(params);
				case 'ignored':
					return chat.parseCommand.ignoreList(params);
				case 'kick':
					return chat.parseCommand.kick(params);
				case 'ban':
					return chat.parseCommand.ban(params);
				case 'mute':
					return chat.parseCommand.mute(params);
				case 'unmute':
					return chat.parseCommand.unmute(params);
				case 'who':
					return chat.parseCommand.who(params);
				case 'whoroom':
					return chat.parseCommand.whoRoom(params);
				case 'list':
					return chat.parseCommand.list(params);
				case 'bans':
					return chat.parseCommand.bans(params);
				case 'baninfo':
					return chat.parseCommand.banInfo(params);
				case 'unban':
					return chat.parseCommand.unban(params);
				case 'ip':
					return chat.parseCommand.ip(params);
				case 'alert':
					return chat.parseCommand.alert(params);
				case 'alerted':
					return chat.parseCommand.alerted(params);
				case 'locate':
					return chat.parseCommand.locate(params);
				case 'roll':
					return chat.parseCommand.roll(params);
				case 'role':
					return chat.parseCommand.role(params);
				case 'delmsg':
					return chat.parseCommand.delmsg(params);
				case 'error':
					return chat.parseCommand.error(params);
			}
		}
		return replaceText(text);
	},
	
	parseCommand: {
		login: function(params) {
			return lang('login', params[0]);
		},

		quit: function(params) {
			return lang('quit', params[0]);
		},
		
		timeout: function(params) {
			return lang('timeout', params[0]);
		},

		roomEnter: function(params) {
			return lang('enter', params[0]);
		},

		roomMove: function(params) {
			var room = params.slice(1).join(' ');
			return lang('move', params[0], '<a href="javascript:chat.sendMessage(\'/go ' + scriptLinkEncode(room) + '\')" title="' + lang('joinRoom', room) + '">' + room + '</a>');
		},
		
		topic: function(params) {
			return lang('topic', params[0], replaceText(params.slice(1).join(' ')));
		},

		away: function(params) {
			return lang('away', params[0]) + (params.length == 1 ? '' : ': ' + replaceText(params.slice(1).join(' ')));
		},

		back: function(params) {
			return lang('back', params[0]);
		},

		ignoreAdded: function(params) {
			return lang('ignoreAdded', params[0]);
		},

		ignoreRemoved: function(params) {
			return lang('ignoreRemoved', params[0]);
		},

		ignoreList: function(params) {
			if (params[0].length) {
				for (var i = 0; i < params.length; i++) params[i] = '<a href="javascript:chat.sendMessage(\'/ignore ' + scriptLinkEncode(params[i]) + '\')" title="' + lang('unignoreUser', params[i]) + '">' + params[i] + '</a>';
				return lang('ignoreList', params.join(', '));
			} else {
				return lang('ignoreListEmpty');
			}
		},

		kick: function(params) {
			return lang('kicked', params[0], params[1], replaceText(params.slice(2).join(' ')));
		},

		ban: function(params) {
			return lang('banned', params[0], formDurationString(+params[1]), params[2], replaceText(params.slice(3).join(' ')));
		},

		mute: function(params) {
			return lang('muted', params[0], params[1]);
		},

		unmute: function(params) {
			return lang('unmuted', params[0], params[1]);
		},

		role: function(params) {
			var roleClass = getRoleClass(params[1])[0].toUpperCase() + getRoleClass(params[1]).slice(1)
			return lang('setRole', params[0], '<span class="' + getRoleClass(params[1]) + ' b">' + roleClass + '</span>');
		},

		who: function(users) {
			for (var i = 0; i < users.length; i++) {
				if (chat.userList.get(users[i])) users[i] = '<a class="b" href="javascript:chat.toggleUserMenu(' + chat.userList.get(users[i]).id + ', true, true)" title="' + lang('navigateUserMenu', users[i]) + '">' + users[i] + '</a>';
				else users[i] = '<a href="javascript:chat.sendMessage(\'/pm ' + users[i] + '\')" title="' + lang('whoQueryOpen', users[i]) + '">' + users[i] + '</a>';
			}
			return lang('who', users.join(', '));
		},

		whoRoom: function(params) {
			params = params.join(' ').split('|');
			var room = params[0];
			var users = params[1].split(' ');
			if (users[0]) {
				for (var i = 0; i < users.length; i++) {
					if (chat.userList.get(users[i])) users[i] = '<a href="javascript:chat.toggleUserMenu(' + chat.userList.get(users[i]).id + ', true, true)" title="' + lang('navigateUserMenu', users[i]) + '">' + users[i] + '</a>';
					else users[i] = '<a href="javascript:chat.sendMessage(\'/pm ' + users[i] + '\')" title="' + lang('whoQueryOpen', users[i]) + '">' + users[i] + '</a>';
				}
				return lang('whoRoom', room, users.join(', '));
			} else {
				return lang('whoEmpty', room);
			}
		},

		list: function(rooms) {
			rooms = rooms.join(' ').split('|');
			for (var i = 0; i < rooms.length; i++) {
				if (rooms[i] == chat.tabs.getFirstRoom().name) rooms[i] = '<span class="b">' + rooms[i] + '</span>';
				else rooms[i] = '<a href="javascript:chat.sendMessage(\'/go ' + scriptLinkEncode(rooms[i]) + '\')" title="' + lang('joinRoom', rooms[i]) + '">' + rooms[i] + '</a>';
			}
			return lang('list', rooms.join(', '));
		},

		bans: function(users) {
			if (users.length) {
				for (var i = 0; i < users.length; i++) users[i] = '<a href="javascript:chat.sendMessage(\'/baninfo ' + users[i] + '\')" title="' + lang('banInfoUser', users[i]) + '">' + users[i] + '</a>';
				return lang('bans', users.join(', '));
			} else {
				return lang('bansEmpty');
			}
		},

		banInfo: function(params) {
			var started = new Date(+params[2] * 1000);
			var expires = new Date(+params[3] * 1000);
			var banned = params[0].length ? 
				'<a href="javascript:chat.sendMessage(\'/unban ' + params[0] + '\')" title="' + lang('unbanUser', params[0]) + '">' + params[0] + '</a> (' + params[1] + ')' :
				'<a href="javascript:chat.sendMessage(\'/unban ' + params[1] + '\')" title="' + lang('unbanUser', params[1]) + '">' + params[1] + '</a>';
			return lang('banInfo', banned, started.toLocaleDateString() + ' @ ' + started.toLocaleTimeString(), expires.toLocaleDateString() + ' @ ' + expires.toLocaleTimeString(), formDurationString((+params[3] - +params[2]) / 60), formDurationString(+params[3] - ((new Date()).valueOf() / 1000)), params[4], replaceText(params.slice(5).join(' ')));
		},

		unban: function(params) {
			return lang('unban', params[0], params[1]);
		},

		ip: function(params) {
			return lang('whois', params[0], params[1]);
		},

		alert: function(params) {
			alert(params[0] + ' has alerted you' + (params.length == 1 ? '' : ': ' + params.slice(1).join(' ')));
			return lang('alert', params[0]) + (params.length == 1 ? '' : ': ' + replaceText(params.slice(1).join(' ')));
		},

		alerted: function(params) {
			return lang('alertSent', params[0]) + (params.length == 1 ? '' : ': ' + replaceText(params.slice(1).join(' ')));
		},

		locate: function(params) {
			return lang('whereis', params[0]) + '<a href="javascript:chat.sendMessage(\'/join ' + scriptLinkEncode(params[1]) + '\')" title="' + lang('joinRoom', params[1]) + '">' + params[1] + '</a>';
		},

		roll: function(params) {
			var rolls = params.slice(3);
			for (var i = 0; i < rolls.length; i++) rolls[i] = lang('rolls', commaFormat(rolls[i]));
			return lang('roll', params[0], commaFormat(params[1]), commaFormat(params[2]), rolls.join(', '));
		},
		
		delmsg: function(params) {
			var node = document.getElementById('m_' + params[0]);
			if (node) node.parentNode.removeChild(node);
		},

		error: function(params) {
			var err = lang('error' + params[0]);
			if (!err) err = params.join(' ');
			else if (params.length > 1) err = err.replace(/%s/, params.slice(1).join(' '));
			return '<span class="error">' + lang('error', htmlEncode(err)) + '</span>';
		}
	}
}
