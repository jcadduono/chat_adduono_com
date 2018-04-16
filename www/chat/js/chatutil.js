function findPos(obj) {
	var curleft = 0, curtop = 0;
	if (obj.offsetParent) {
		curleft = obj.offsetLeft
		curtop = obj.offsetTop
		while ((obj = obj.offsetParent)) {
			curleft += obj.offsetLeft
			curtop += obj.offsetTop
		}
	}
	return [curleft, curtop];
}

function scriptLinkEncode(str) {
	return htmlDecode(str).replace(/\\/g, '\\\\').replace(/\'/g, '\\\'');
}

function htmlEncode(str) {
	return str.replace(/[&<>\'"]/g, htmlEncodeCallback);
}

function htmlEncodeCallback(str) {
	switch (str) {
		case '&':
			return '&amp;';
		case '<':
			return '&lt;';
		case '>':
			return '&gt;';
		case '\'':
			return '&#39;';
		case '"':
			return '&quot;';
		default:
			return str;
	}
}

function htmlDecode(str) {
	return str.replace(/(&(?:amp|lt|gt|#39|quot);)/g, htmlDecodeCallback);
}

function htmlDecodeCallback(str) {
	switch (str) {
		case '&amp;':
			return '&';
		case '&lt;':
			return '<';
		case '&gt;':
			return '>';
		case '&#39;':
			return '\'';
		case '&quot;':
			return '"';
		default:
			return str;
	}
}

function inArrayCI(arr, str) {
	if (str === null) return false;
	for (var i = 0; i < arr.length; i++) if (arr[i].toLowerCase() == str.toLowerCase()) return true;
	return false;
}

function formatDate(format, date) {
	if (!date) date = new Date();
	return format.replace(/%Y/g, date.getFullYear()).replace(/%m/g, addLeadingZero(date.getMonth() + 1))
		.replace(/%d/g, addLeadingZero(date.getDate())).replace(/%H/g, addLeadingZero(date.getHours()))
		.replace(/%i/g, addLeadingZero(date.getMinutes())).replace(/%s/g, addLeadingZero(date.getSeconds()));
}

function addLeadingZero(number) {
	return number.toString().length < 2 ? '0' + number : number;
}

function getWordStartPos(s, pos) {
	while (s[pos - 1] == " ") pos--;
	return s.lastIndexOf(" ", pos) + 1;
}

function getWordEndPos(s, pos) {
	pos = getWordStartPos(s, pos);
	var end = s.indexOf(" ", pos);
	return (end == -1) ? s.length : end;
}

function getWordAt(s, pos) {
	return s.substring(getWordStartPos(s, pos), getWordEndPos(s, pos));
}

function commaFormat(num) {
	return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formDurationString(seconds) {
	var weeks, days, hours, mins, secs, duration = [];
	if (weeks = Math.floor(seconds / 604800)) duration.push(weeks + ' week' + (weeks != 1 ? 's' : ''));
	if (days = Math.floor(seconds % 604800 / 86400)) duration.push(days + ' day' + (days != 1 ? 's' : ''));
	if (hours = Math.floor(seconds % 86400 / 3600)) duration.push(hours + ' hour' + (hours != 1 ? 's' : ''));
	if (mins = Math.floor(seconds % 3600 / 60)) duration.push(mins + ' minute' + (mins != 1 ? 's' : ''));
	if (secs = Math.floor(seconds % 60)) duration.push(secs + ' second' + (secs != 1 ? 's' : ''));
	if (duration.length > 1) duration[duration.length - 1] = 'and ' + duration[duration.length - 1];
	return duration.join(duration.length == 2 ? ' ' : ', ');
}

function lang(key) {
	var val = replaceBBCode(chatLang[key]);
	for (var i = 1; i < arguments.length; i++) val = val.replace(/%s/, arguments[i]);
	return val;
}

function showHide(id, display) {
	var node = document.getElementById(id);
	if (node) {
		if (display) node.style.display = display;
		else node.style.display = node.style.display == 'none' ? 'block' : 'none';
	}
}

function toggleContainer(containerID, hideContainerIDs, noHide) {
	if (hideContainerIDs) for(var i = 0; i < hideContainerIDs.length; i++) showHide(hideContainerIDs[i], 'none');	
	showHide(containerID, noHide ? 'block' : false);
	var containerWidth = document.getElementById(containerID).offsetWidth;
	if (containerWidth) chat.dom.messages.style.right = (containerWidth + 14) + 'px';	
	else chat.dom.messages.style.right = '10px';
	chat.focusInput();
	chat.updateAutoScroll();
}

function showPhotoFloat(id) {
	var apos = findPos(document.getElementById('u_' + id));
	var af = chat.dom.photoFloat;
	af.src = chat.userList.get(id).photo;
	var w = Math.min(250, af.width);
	var h = Math.floor(w / (af.width / af.height));
	af.style.width = w + 'px';
	af.style.height = h + 'px';
	af.style.top = Math.max(0, Math.min(window.innerHeight - h, Math.floor(apos[1] + 13 - h / 2))) + 'px';
	af.style.left = (apos[0] - 6 - w) + 'px';
	af.style.display = 'block';
}

function hidePhotoFloat() {
	chat.dom.photoFloat.style.display = 'none';
	chat.dom.photoFloat.src = 'img/loading.gif';
}

function parseFontStyleString(str) {
	if (!str || str == '') str = chat.defaultSettings.fontStyle;
	var textParts = str.split('|');
	return { size: +textParts[0], family: +textParts[1], color: textParts[2], b: textParts[3] == "1", i: textParts[4] == "1", u: textParts[5] == "1" };
}

function createMessageNode(date, userID, userName, userRole, id, style, message) {
	var html = '',
		node = document.createElement('div'),
		cmd = message.split(' ')[0],
		action = !!(cmd == '/action' || cmd == '/me' || cmd == '/do');
	if (chat.settings.timeStamps) html += '<span class="time">' + formatDate(chat.settings.dateFormat, date) + '</span> ';
	if (id) {
		node.id = 'm_' + id;
		if (chat.userRole >= 2 && chat.userRole >= userRole) html += '<span class="delete" title="' + lang('deleteMessage') + '" onclick="chat.deleteMessage(' + id + ')"></span>';
	}
	if (userRole == 0) {
		node.innerHTML = html + '<span class="server">' + message + '</span>';
	}
	else {
		style = parseFontStyleString(style);
		node.innerHTML = html
			+ '<span class="name ' + getRoleClass(userRole) + (action ? ' action' : '') + '" onclick="chat.toggleUserMenu(' + userID + ', true, true)">' + userName + '</span>'
			+ (action ? ' ' : ': ')
			+ (chat.settings.fontStyles ? '<span class="' + (action ? 'action' : 'font' + style.family + (style.b ? ' b' : '') + (style.i ? ' i' : '') + (style.u ? ' u' : '') + '" style="' + 'font-size:' + style.size + 'px;' + 'color:#' + style.color + ';') + '">' : '')
			+ message
			+ (chat.settings.fontStyles ? '</span>' : '');
	}
	return node;
}

function getRoleClass(id) {
	switch (+id) {
		case 0:
			return 'server';
		case 2:
			return 'host';
		case 3:
			return 'admin';
		case 4:
			return 'owner';
		default:
			return 'user';
	}
}

function replaceText(text) {
	return replaceEmoticons(replaceHyperLinks(replaceBBCode(replaceLineBreaks(htmlEncode(text)))));
}

function bbTag(text, tag, attr, close) {
	switch (tag) {
		case 'b':
		case 'i':
		case 'u':
			return '<span class="' + tag + '">' + bbParse(text) + '</span>';
		case 'code':
			return '<code>' + text.replace(/\t|  /g, '&#160; ') + '</code>';
		case 'color':
			return attr.match(/^#?[a-z0-9]+$/i) ? '<span style="color:' + attr + '">' + bbParse(text) + '</span>' : bbParse(text);
		case 'quote':
			return attr && attr.match(/^[\w-.& ]+$/) ? '<span class="quote"><cite>' + lang('cite', attr) + '</cite><q>' + bbParse(text) + '</q></span>' : '<span class="quote"><q>' + bbParse(text) + '</q></span>';
		case '?':
			return '<img alt="help" src="img/help.png" onclick="toggleContainer(\'helpContainer\', [\'onlineListContainer\',\'settingsContainer\'], true)">' + bbParse(text);
		default:
			return '[' + tag + (attr ? '=' + attr : '') + ']' + bbParse(text) + (close ? '[/' + tag + ']' : '');
	}
}

function bbFindClose(text, tag, attr) {
	var tagStart, p = 0, nest = 0;
	while (p < text.length) if (text[p++] == '[') {
		if (text[p] == '/') {
			tagStart = p + 1;
			while (p < text.length) if (text[p++] == ']') {
				if (text.substring(tagStart, p - 1).toLowerCase() == tag && !nest--) return bbTag(text.substr(0, tagStart - 2), tag, attr, true) + bbParse(text.substr(p));
				break;
			}
		}
		else {
			tagStart = p++;
			while (p < text.length) {
				if (text[p] == ']' || text[p] == '=') {
					text.substring(tagStart, p++).toLowerCase() == tag && nest++;
					break;
				}
				p++;
			}
		}
	}
	return bbTag(text, tag, attr);
}

function bbParse(text) {
	var p = 0;
	while (p < text.length) if (text[p++] == '[') {
		var tagStart = p;
		while (p < text.length) {
			if (text[p] == '=') {
				var tag = text.substring(tagStart, p++).toLowerCase(), attrStart = p;
				while (p < text.length) if (text[p++] == ']') return text.substr(0, tagStart - 1) + bbFindClose(text.substr(p), tag, text.substring(attrStart, p - 1));
			}
			else if (text[p++] == ']') return text.substr(0, tagStart - 1) + bbFindClose(text.substr(p), text.substring(tagStart, p - 1).toLowerCase());
		}
	}
	return text;
}

function replaceBBCode(text) {
	return chat.settings.bbCode ? bbParse(text) : text.replace(/\[(?:\/)?(\w+)(?:=([^<>]*?))?\]/gi, '');
}

function getMagnetName(magnet) {
	var dn = magnet.match(/[?&]dn=([^&]+)/i);
	return dn ? decodeURIComponent(dn[1].replace(/\+/g, ' ')) : 'Magnet Link';
}

function splitProtocol(url) {
	return url.split(':')[1].split('?')[0];
}

function replaceHyperLinks(str) {
	if (!chat.settings.hyperLinks) return str;
	return str.replace(/(^|\s|>)((?:(?:https?|s?ftp|ircs?):\/\/|magnet:|skype:|facebook:)[^\s<>]+)(<\/(?:a|code)>)?/gi,
		function(str, p1, p2, p3) {
			if (p3) return str;
			if (chat.settings.images && p2.match(/^https?:\/\/(?:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[-a-z0-9]+\.)+[a-z]{2,6})\/[^?]+\.(?:jpe?g|gif|png|bmp|svg)$/i)) return p1 + '<a href="' + p2 + '" onclick="window.open(this.href); return false">' + '<img class="image" src="' + p2 + '" alt="" onload="chat.tabs.active.scroll()"></a>';
			if (chat.settings.youTube) {
				var yt = p2.match(/youtu(?:be\.com|\.be)\/(?:.*(?:\?|&amp;)v=|v\/)?(?!watch)([\w-]+)/i);
				if (yt) return p1 + '<object onload="chat.tabs.active.scroll()" class="youtube" type="application/x-shockwave-flash" data="//www.youtube.com/v/' + yt[1] + '"><param name="movie" value="//www.youtube.com/v/' + yt[1] + '"><param name="allowFullScreen" value="true"><param name="allowscriptaccess" value="always"></object>';
			}
			if (p2.substr(0, 7).toLowerCase() == 'magnet:') return p1 + '<a class="magnet" title="' + lang('downloadTorrent') + '" href="' + p2 + '">' + htmlEncode(getMagnetName(htmlDecode(p2))) + '</a>';
			if (p2.substr(0, 6).toLowerCase() == 'skype:') return p1 + '<a class="skype" title="' + lang('addSkypeContact') + '" href="skype:' + splitProtocol(p2) + '?add">' + splitProtocol(p2) + '</a>';
			if (p2.substr(0, 9).toLowerCase() == 'facebook:') return p1 + '<a class="facebook" target="_blank" title="' + lang('findOnFacebook') + '" href="https://www.facebook.com/' + splitProtocol(p2) + '">' + splitProtocol(p2) + '</a>';
			return p1 + '<a href="' + p2 + '" onclick="window.open(this.href); return false">' + p2 + '</a>';
		}
	);
}

function replaceLineBreaks(str) {
	return str.replace(/\n/g, chat.settings.lineBreaks ? '<br>' : ' ');
}

function getEmoticonRegExStr() {
	var s = '^(.*)(';
	for (var e in chat.emoticons) s += escapeRegExp(htmlEncode(e)) + '|';
	return s.slice(0, -1) + ')(.*)$';
}

var emoticonsMatch;

function replaceEmoticons(str) {
	if (!emoticonsMatch) emoticonsMatch = new RegExp(getEmoticonRegExStr(), 'gm');
	if (!chat.settings.emoticons) return str;
	return str.replace(emoticonsMatch, replaceEmoticonsCallback);
}

function replaceEmoticonsCallback(str, p1, p2, p3) {
	if (p1.match(/(="[^"]*$)|(&[^;]*$)/)) return str;
	var skipTags = str.match(/^(.*)(<(?:code|a [^>]+)>.*<\/(?:code|a)>)(.*)$/i);
	if (skipTags) return replaceEmoticons(skipTags[1]) + skipTags[2] + replaceEmoticons(skipTags[3]);
	if (p2) return replaceEmoticons(p1) + '<img src="img/emoticons/' + chat.emoticons[htmlDecode(p2)] + '" alt="' + p2 + '" title="' + p2 + '">' + replaceEmoticons(p3);
	return str;
}

function escapeRegExp(str) {
	return str.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
}

