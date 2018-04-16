var usernameTimer, passwordTimer, emailTimer, validStr = String.fromCharCode(10003);

var usernameChecker = new XMLHttpRequest();
usernameChecker.onreadystatechange = function() {
	if (usernameChecker.readyState == 4) {
		try {
			var result = JSON.parse(usernameChecker.responseText);
			if (result.username == 1) {
				usernameMsg.nodeValue = validStr;
				usernameMsg.parentNode.style.color = '#00DD00';
			}
			else {
				usernameMsg.nodeValue = 'That username is already taken.';
				usernameMsg.parentNode.style.color = '#FF0000';
			}
		} catch (e) {
			usernameMsg.nodeValue = 'There was an error while checking for username availability.';
			usernameMsg.parentNode.style.color = '#FF0000';
		}
	}
}

function validateUsername() {
	if (usernameField.value.length >= 3 && usernameField.value.length <= 18) {
		if (usernameField.value.match(/^[\w-.]+$/)) {
			try {
				if (usernameChecker.readyState !== 4 && usernameChecker.readyState !== 0) usernameChecker.abort();
				usernameChecker.open('GET', '../scripts/check.ljs?username=' + encodeURIComponent(usernameField.value), true);
				usernameChecker.setRequestHeader('Accept', 'application/json');
				usernameChecker.setRequestHeader('Accept-Language', '');
				usernameChecker.send();
			} catch (e) { }
		} else {
			usernameMsg.nodeValue = 'Only letters (a-Z), numbers (0-9), hyphens (-), underscores (_), and periods (.) are allowed.';
			usernameMsg.parentNode.style.color = '#FF0000';
		}
	} else {
		usernameMsg.nodeValue = 'Usernames must be 3 to 18 characters in length.';
		usernameMsg.parentNode.style.color = '#FF0000';
	}
}

function validatePassword() {
	if (passwordField.value.match(/^\S{6,32}$/)) {
		passwordMsg.nodeValue = validStr;
		passwordMsg.parentNode.style.color = '#00DD00';
		if (password2Field.value !== '') {
			if (passwordField.value === password2Field.value) {
				password2Msg.nodeValue = validStr;
				password2Msg.parentNode.style.color = '#00DD00';
			} else {
				password2Msg.nodeValue = 'The passwords don\'t match.';
				password2Msg.parentNode.style.color = '#FF0000';
			}
		}
	} else {
		passwordMsg.nodeValue = 'Passwords must be 6 to 32 characters in length and cannot contain a space.';
		passwordMsg.parentNode.style.color = '#FF0000';
		password2Msg.nodeValue = '';
	}
}

var emailChecker = new XMLHttpRequest();
emailChecker.onreadystatechange = function() {
	if (emailChecker.readyState == 4) {
		try {
			var result = JSON.parse(emailChecker.responseText);
			if (result.email == 1) {
				emailMsg.nodeValue = validStr;
				emailMsg.parentNode.style.color = '#00DD00';
			}
			else {
				emailMsg.nodeValue = 'That email is already registered. Did you forget your login info?';
				emailMsg.parentNode.style.color = '#FF0000';
			}
		} catch (e) {
			emailMsg.nodeValue = 'There was an error while checking for email availability.';
			emailMsg.parentNode.style.color = '#FF0000';
		}
	}
}

function validateEmail() {
	if (emailField.value.match(/^[\w.-]+@[a-z0-9.-]+\.[a-z]{2,4}$/i)) {
		try {
			if (emailChecker.readyState !== 4 && emailChecker.readyState !== 0) emailChecker.abort();
			emailChecker.open('GET', '../scripts/check.ljs?email=' + encodeURIComponent(emailField.value), true);
			emailChecker.setRequestHeader('Accept', 'application/json');
			emailChecker.setRequestHeader('Accept-Language', '');
			emailChecker.send();
		} catch (e) { }
	} else {
		emailMsg.nodeValue = 'That\'s not a valid email address.';
		emailMsg.parentNode.style.color = '#FF0000';
	}
}

function shouldValidate(input, textNode) {
	if (input.value !== '') {
		textNode.firstChild.nodeValue = '...';
		textNode.style.color = '#FFFFFF';
		return true;
	} else {
		textNode.firstChild.nodeValue = '';
	}
}

function validate(input) {
	if (input == usernameField) {
		clearTimeout(usernameTimer);
		if (shouldValidate(input, input.nextSibling)) usernameTimer = setTimeout(validateUsername, 1000);
	}
	else if (input == passwordField || input == password2Field) {
		clearTimeout(passwordTimer);
		if (shouldValidate(input, input.nextSibling)) passwordTimer = setTimeout(validatePassword, 1000);
	}
	else if (input == emailField) {
		clearTimeout(emailTimer);
		if (shouldValidate(input, input.nextSibling)) emailTimer = setTimeout(validateEmail, 1000);
	}
}

function usernameValidated() {
	if (usernameMsg.nodeValue == validStr) return true;
	validateUsername();
	return false;
}

function passwordValidated() {
	if (passwordMsg.nodeValue == validStr & password2Msg.nodeValue == validStr) return true;
	validatePassword();
	return false;
}

function emailValidated() {
	if (emailMsg.nodeValue == validStr) return true;
	validateEmail();
	return false;
}

function initValidate() {
	usernameField = document.getElementsByName('username')[0];
	usernameMsg = document.createElement('span').appendChild(document.createTextNode(''))
	usernameField.parentNode.insertBefore(usernameMsg.parentNode, usernameField.nextSibling);
	passwordField = document.getElementsByName('password')[0];
	passwordMsg = document.createElement('span').appendChild(document.createTextNode(''))
	passwordField.parentNode.insertBefore(passwordMsg.parentNode, passwordField.nextSibling);
	password2Field = document.getElementsByName('password2')[0];
	password2Msg = document.createElement('span').appendChild(document.createTextNode(''))
	password2Field.parentNode.insertBefore(password2Msg.parentNode, password2Field.nextSibling);
	emailField = document.getElementsByName('email')[0];
	emailMsg = document.createElement('span').appendChild(document.createTextNode(''))
	emailField.parentNode.insertBefore(emailMsg.parentNode, emailField.nextSibling);
}