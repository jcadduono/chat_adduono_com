function ChatUser(id, name, role, photo, muted, typing, away) {
	this.id = id;
	this.name = name;
	this.name_lower = name.toLowerCase();
	this.muted = muted;
	this.ignored = inArrayCI(chat.settings.ignoredNames, name);
	this.typing = typing;
	this.away = away;
	this.creating = true;
	this.nodes = {};
	this.nodes.main = document.createElement('div');
	this.nodes.main.id = 'u_' + id;
	this.nodes.photo = document.createElement('img');
	this.nodes.photo.alt = '';
	this.nodes.photo.onmouseout = hidePhotoFloat;
	this.nodes.photo.onmouseover = function() { showPhotoFloat(id); }
	this.nodes.main.appendChild(this.nodes.photo);
	this.nodes.name = document.createElement('a');
	this.nodes.name.href = 'javascript:chat.toggleUserMenu(' + id + ')';
	this.nodes.nameText = document.createTextNode('');
	this.nodes.name.appendChild(this.nodes.nameText);
	this.nodes.main.appendChild(this.nodes.name);
	this.nodes.menu = document.createElement('div');
	this.nodes.main.appendChild(this.nodes.menu);
	this.setRole(role);
	this.setPhoto(photo);
	this.setExpanded(id == chat.userID);
	delete this.creating;
	this.updateTitle();
	this.updateMenu();
}

ChatUser.prototype.updateTitle = function() {
	if (this.creating) return;
	var suffix = [];
	if (this.role == 4) suffix.push('The Creator');
	else if (this.role == 3) suffix.push('Admin');
	else if (this.role == 2) suffix.push('Host');
	if (this.typing) suffix.push('Typing');
	if (this.away !== false) suffix.push('Away');
	if (this.muted) suffix.push('Muted');
	this.nodes.nameText.nodeValue = suffix.length ? this.name + ' (' + suffix.join(', ') + ')' : this.name;
	this.nodes.name.title = lang('toggleUserMenu', this.name);
}

ChatUser.prototype.updateMenu = function() {
	if (this.creating) return;
	var menu = '';
	if (typeof this.away == 'string') menu += '<span class="away">' + replaceBBCode(htmlEncode(this.away)) + '</span>';
	if (this.id !== chat.userID) {
		menu += '<a href="javascript:chat.setMessage(\'/msg ' + this.name + ' \')">' + lang('userMenuSendPrivateMessage') + '</a>'
			+ '<a href="javascript:chat.setMessage(\'/describe ' + this.name + ' \')">' + lang('userMenuDescribe') + '</a>'
			+ (chat.tabs.getQuery(this.name) ?
				'<a href="javascript:chat.sendMessage(\'/cpm ' + this.name + '\')">' + lang('userMenuCloseQuery') + '</a>' :
				'<a href="javascript:chat.sendMessage(\'/pm ' + this.name + '\')">' + lang('userMenuOpenQuery') + '</a>')
			+ '<a href="javascript:chat.sendMessage(\'/ignore ' + this.name + '\')">' + (this.ignored ? lang('userMenuUnignore') : lang('userMenuIgnore')) + '</a>';
		if (chat.userRole > 1) menu += '<a href="javascript:chat.setMessage(\'/alert ' + this.name + ' \')">' + lang('userMenuAlert') + '</a>';
		if (chat.userRole > 1 && chat.userRole > this.role) {
			menu += '<a href="javascript:chat.setMessage(\'/kick ' + this.name + ' \')">' + lang('userMenuKick') + '</a>'
				+ '<a href="javascript:chat.setMessage(\'/ban ' + this.name + ' 60 \')">' + lang('userMenuBan') + '</a>'
				+ '<a href="javascript:chat.sendMessage(\'/' + (this.muted ? 'unmute ' : 'mute ') + this.name + '\')">' + (this.muted ? lang('userMenuUnmute') : lang('userMenuMute')) + '</a>'
				+ '<a href="javascript:chat.sendMessage(\'/ip ' + this.name + '\')">' + lang('userMenuWhois') + '</a>';
		}
	} else {
		menu += (this.away ?
				'<a href="javascript:chat.sendMessage(\'/back\')">' + lang('userMenuBack') + '</a>':
				'<a href="javascript:chat.setMessage(\'/away \')">' + lang('userMenuAway') + '</a>')
			+ '<a href="javascript:chat.sendMessage(\'/who\')">' + lang('userMenuWho') + '</a>'
			+ '<a href="javascript:chat.sendMessage(\'/ignore\')">' + lang('userMenuIgnoreList') + '</a>'
			+ (this.role > 1 ? '<a href="javascript:chat.sendMessage(\'/bans\')">' + lang('userMenuBans') + '</a>' : '')
			+ '<a href="javascript:chat.sendMessage(\'/list\')">' + lang('userMenuList') + '</a>'
			+ '<a href="javascript:chat.setMessage(\'/me \')">' + lang('userMenuAction') + '</a>'
			+ '<a href="javascript:chat.setMessage(\'/roll \')">' + lang('userMenuRoll') + '</a>';
	}
	menu += '<a href="/p/' + this.name + '" target="_blank">' + lang('userMenuViewProfile') + '</a>';
	this.nodes.menu.innerHTML = menu;
}

ChatUser.prototype.setName = function(name) {
	delete chat.userList.nameMap[this.name_lower];
	this.name = name;
	this.name_lower = name.toLowerCase();
	chat.userList.nameMap[this.name_lower] = this;
	this.updateTitle();
	this.updateMenu();
}

ChatUser.prototype.setRole = function(role) {
	this.role = role;
	this.nodes.name.className = this.ignored ? getRoleClass(role) + ' ignored' : getRoleClass(role);
	this.updateTitle();
	this.updateMenu();
}

ChatUser.prototype.setPhoto = function(photo) {
	this.photo = '../profile/photos/' + photo + '.jpg';
	if (!this.muted) this.nodes.photo.src = this.photo;
}

ChatUser.prototype.setMuted = function(muted) {
	this.muted = !!muted;
	this.nodes.photo.src = muted ? './img/muted.png' : this.photo;
	this.updateTitle();
	this.updateMenu();
}

ChatUser.prototype.setIgnored = function(ignored) {
	this.ignored = !!ignored;
	this.nodes.name.className = ignored ? getRoleClass(this.role) + ' ignored' : getRoleClass(this.role);
	this.updateMenu();
}

ChatUser.prototype.setAway = function(away) {
	this.away = away.length ? away : !!away
	this.updateTitle();
	this.updateMenu();
}

ChatUser.prototype.setTyping = function(typing) {
	this.typing = !!typing;
	this.updateTitle();
}

ChatUser.prototype.setExpanded = function(expanded) {
	this.expanded = !!expanded;
	this.nodes.menu.style.display = expanded ? 'block' : 'none';
}

function UserList() {
	this.idMap = {};
	this.nameMap = {};
	this.users = [];
	while (chat.dom.onlineList.hasChildNodes()) chat.dom.onlineList.removeChild(chat.dom.onlineList.lastChild);
}

UserList.prototype.get = function(user) {
	if (typeof user == 'string') return this.nameMap[user.toLowerCase()] || false;
	if (typeof user == 'number') return this.idMap[user] || false;
	return false;
}

UserList.prototype.add = function(user) {
	this.idMap[user.id] = user;
	this.nameMap[user.name_lower] = user;
	this.users.push(user);
}

UserList.prototype.remove = function(user) {
	if (user in this.idMap) {
		this.users.splice(this.users.indexOf(this.idMap[user]), 1);
		delete this.nameMap[this.idMap[user].name_lower];
		delete this.idMap[user];
	}
}

UserList.prototype.sort = function() {
	this.users.sort(userSortCompare);
	while (chat.dom.onlineList.hasChildNodes()) chat.dom.onlineList.removeChild(chat.dom.onlineList.lastChild);
	for (var i = 0; i < this.users.length; i++) chat.dom.onlineList.appendChild(this.users[i].nodes.main);
	chat.dom.userCount.innerHTML = '<span class="b">' + commaFormat(this.users.length) + '</span> User' + (this.users.length != 1 ? 's' : '');
}

function userSortCompare(a, b) {
	if (a.id === chat.userID) return -1;
	if (b.id === chat.userID) return 1;
	if (a.role != b.role) return a.role > b.role ? -1 : 1;
	return a.name_lower < b.name_lower ? -1 : 1;
}
