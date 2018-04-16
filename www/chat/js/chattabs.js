function ChatTab(name, type) {
	this.flashTimer = null;
	this.name = name;
	this.type = type;
	this.nodes = {};
	this.storedMessage = '';
	this.nodes.main = document.createElement('div');
	this.nodes.tab = document.createElement('button');
	this.nodes.name = document.createTextNode(name);
	this.nodes.main.appendChild(this.nodes.tab);
	this.nodes.messages = document.createElement('div');
	if (type === 'query') {
		this.nodes.img = document.createElement('img');
		this.nodes.img.src = 'img/user.png';
		this.nodes.img.alt = '';
		this.nodes.tab.appendChild(this.nodes.img);
		this.nodes.close = document.createElement('button');
		this.nodes.close.className = 'tabClose';
		this.nodes.close.appendChild(document.createTextNode('x'));
		this.nodes.main.appendChild(this.nodes.close);
	}
	this.updateNodes();
	this.nodes.tab.appendChild(this.nodes.name);
	this.activate();
}

ChatTab.prototype.updateNodes = function() {
	if (this.type === 'room') {
		this.nodes.tab.setAttribute('onclick', 'chat.tabs.openRoom(\'' + scriptLinkEncode(this.name) + '\')');
	}
	else if (this.type === 'query') {
		this.nodes.tab.setAttribute('onclick', 'chat.sendMessage(\'/pm ' + scriptLinkEncode(this.name) + '\')');
		this.nodes.close.setAttribute('onclick', 'chat.sendMessage(\'/cpm ' + scriptLinkEncode(this.name) + '\')');
	}
	this.nodes.name.nodeValue = this.name;
}

ChatTab.prototype.flash = function() {
	clearInterval(this.flashTimer);
	var self = this;
	this.flashTimer = setInterval(function() {
		self.nodes.tab.className = self.nodes.tab.className == 'chatTab' ? 'chatTab tabFlashing' : 'chatTab';
	}, chat.settings.blinkInterval);
}

ChatTab.prototype.stopFlashing = function() {
	this.nodes.tab.className = 'chatTab';
	clearInterval(this.flashTimer);
}

ChatTab.prototype.activate = function() {
	this.active = true;
	this.nodes.tab.disabled = true;
	this.stopFlashing();
	this.scroll();
	this.nodes.messages.style.visibility = 'visible';
	var self = this;
	setTimeout(function() { chat.dom['inputField'].value = self.storedMessage; }, 10);
}

ChatTab.prototype.deactivate = function() {
	this.active = false;
	this.nodes.tab.className = 'chatTab';
	this.nodes.tab.disabled = false;
	this.nodes.messages.style.visibility = 'hidden';
	this.storedMessage = chat.dom['inputField'].value;
}

ChatTab.prototype.addMessage = function(date, userID, userName, userRole, id, style, message) {
	if (id && document.getElementById('m_' + id)) return;
	this.nodes.messages.appendChild(createMessageNode(date, userID, userName, userRole, id, style, message));
	this.scroll();
	this.removeExpiredMessages();
	if (!this.active) this.flash();
}

ChatTab.prototype.clearMessages = function() {
	while (this.nodes.messages.hasChildNodes()) this.nodes.messages.removeChild(this.nodes.messages.firstChild);
}

ChatTab.prototype.removeExpiredMessages = function() {
	if (this.nodes.messages.childNodes && chat.settings.maxMessages) {
		while (this.nodes.messages.childNodes.length > chat.settings.maxMessages) {
			this.nodes.messages.removeChild(this.nodes.messages.firstChild);
		}
	}
}

ChatTab.prototype.scroll = function() {
	if (chat.settings.autoScroll) this.nodes.messages.scrollTop = this.nodes.messages.scrollHeight;	
}

function ChatTabs() {
	this.roomMap = {};
	this.queryMap = {};
	this.tabs = [];
}

ChatTabs.prototype.getFirstRoom = function() {
	for (var i = 0; i < this.tabs.length; i++) if (this.tabs[i].type == 'room') return this.tabs[i];
	return false;
}

ChatTabs.prototype.getRoom = function(name) {
	return this.roomMap[name.toLowerCase()] || false;
}

ChatTabs.prototype.getQuery = function(name) {
	return this.queryMap[name.toLowerCase()] || false;
}

ChatTabs.prototype.openRoom = function(name) {
	var room = this.getRoom(name);
	if (this.active) {
		if (this.active.name == 'Status') this.closeRoom('Status')
		else this.active.deactivate();
	}
	if (!room) {
		room = new ChatTab(name, 'room');
		this.roomMap[room.name.toLowerCase()] = room;
		this.tabs.push(room);
		chat.dom.tabRoomContainer.appendChild(room.nodes.main);
		chat.dom.messages.appendChild(room.nodes.messages);
	}
	room.activate();
	this.active = room;
}

ChatTabs.prototype.openQuery = function(name) {
	var query = this.getQuery(name);
	if (this.active) this.active.deactivate();
	if (!query) {
		query = new ChatTab(name, 'query');
		this.queryMap[query.name.toLowerCase()] = query;
		this.tabs.push(query);
		chat.dom.tabQueryContainer.appendChild(query.nodes.main);
		chat.dom.messages.appendChild(query.nodes.messages);
	}
	query.activate();
	this.active = query;
}

ChatTabs.prototype.closeRoom = function(name) {
	var room = this.getRoom(name);
	if (room) {
		delete this.roomMap[room.name.toLowerCase()];
		this.tabs.splice(this.tabs.indexOf(room), 1);
		if (room.active) {
			this.active = this.getFirstRoom();
			if (this.active) this.active.activate();
		}
		chat.dom.tabRoomContainer.removeChild(room.nodes.main);
		chat.dom.messages.removeChild(room.nodes.messages);
	}
}

ChatTabs.prototype.closeQuery = function(name) {
	var query = this.getQuery(name);
	if (query) {
		delete this.queryMap[query.name.toLowerCase()];
		this.tabs.splice(this.tabs.indexOf(query), 1);
		if (query.active) {
			this.active = this.getFirstRoom();
			if (this.active) this.active.activate();
		}
		chat.dom.tabQueryContainer.removeChild(query.nodes.main);
		chat.dom.messages.removeChild(query.nodes.messages);
	}
}
