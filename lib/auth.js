const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const student = require("./student");

let privKey;

const init = () => {
	privKey = crypto.randomBytes(256);
};

let jwtValidTokens = [];

const verify = (token) => {
	try {
		let decoded = jwt.verify(token, privKey);
		if (jwtValidTokens[decoded.token] === true) return {num: decoded.num, name: decoded.name, token: decoded.token};
		else return false;
	} catch (e) {
		return false;
	}
};

const expire = loginToken => {
	if (jwtValidTokens[loginToken] === true) delete jwtValidTokens[loginToken];
};

const login = ({num, name}) => {
	let find = student.find(name, num);
	if (find === null) return false;
	let loginToken = crypto.randomBytes(32).toString('hex');
	jwtValidTokens[loginToken] = true;
	return jwt.sign({
		num: find.num,
		name: find.name,
		token: loginToken,
	}, privKey, {
		expiresIn: parseInt(Date.now() / 1000) + 60 * 60 * 24 * 7
	});
};

module.exports = {
	init,
	verify,
	expire,
	login,
};
