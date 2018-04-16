function updateBanHTML() {	if (typeof roomEnterButtons != 'undefined' && banRemaining <= 0) {		clearInterval(banTimer)
		for (var i = 0; i < roomEnterButtons.length; i++) {
			roomEnterButtons[i].removeAttribute('disabled');
			roomEnterButtons[i].removeAttribute('title');
		}
		var banned = document.getElementById('banned');
		banned.parentNode.removeChild(banned);	}	banRemainingNode.nodeValue = formDurationString(banRemaining);}function subBanRemaining() {	banRemaining--;	updateBanHTML();}if (typeof banRemaining != 'undefined') {	var banRemainingNode = document.createTextNode(formDurationString(banRemaining));	var banTimer = setInterval(subBanRemaining, 1000);}

function initLobby() {
	if (typeof banTimer != 'undefined') {
		document.getElementById('ban_remaining').appendChild(banRemainingNode);
		roomEnterButtons = document.getElementsByName('room');
		for (var i = 0; i < roomEnterButtons.length; i++) {
			roomEnterButtons[i].setAttribute('disabled', 'disabled');
			roomEnterButtons[i].setAttribute('title', 'You are still banned. You\'ll have to wait until the timer runs out.');
		}
	}
}