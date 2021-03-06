const express = require('express');
const queue = require('express-queue');
const router = express.Router();

const student = require("../lib/student");
const auth = require("../lib/auth");
const db = require("../lib/db");

router.use(((req, res, next) => {
	res.header('Content-Type', 'application/json; charset=utf-8');
	next();
}));

router.post("/auth/login", (req, res) => {
	let {jwt, num, name} = req.body;
	let login_data;
	if (typeof jwt === "string" && num === undefined && name === undefined) {
		login_data = auth.verify(jwt);
		if (typeof login_data === "object" && login_data.num !== null) {
			let temp = student.findByNum(login_data.num);
			if (temp !== null) login_data.name = temp.name;
		}
	} else if (jwt === undefined && typeof num === "string" && typeof name === "string") {
		login_data = {
			num: num,
			name: name
		};
	}

	if (typeof login_data !== "object") {
		res.status(400).end(JSON.stringify({
			result: 1,
		}, null, 4));
		return;
	}

	let token = auth.login(login_data);
	if (token === false) {
		res.status(400).end(JSON.stringify({
			result: 1,
			result_data: "잘못 입력하였습니다."
		}, null, 4));
		return;
	}
	res.header('Set-Cookie', `auth=${token}; expires=${new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toUTCString()}; path=/; overwrite=true;`);
	res.status(200).end(JSON.stringify({
		result: 0,
		result_data: Object.assign({
			num: login_data.num,
			name: login_data.name,
		}, login_data.num === "admin" ? {
			isAdmin: true
		} : {}),
	}));
});

router.get('/auth/logout', (req, res) => {
	let data = auth.verify(req.cookies.auth);
	if (data === false) {
		res.clearCookie("auth");
		res.status(403).end(JSON.stringify({
			result: 403,
		}, null, 4));
		return;
	}
	auth.expire(data.token);
	res.status(200).end(JSON.stringify({
		result: 0
	}, null, 4));
});

router.use((req, res, next) => {
	let data = auth.verify(req.cookies.auth);
	if (data === false) {
		res.clearCookie("auth", {path: '/'});
		res.status(403).end(JSON.stringify({
			result: 403,
		}, null, 4));
		return;
	}
	req.stu_info = data;

	if ((data.iat + 60 * 60 * 24) * 1000 < Date.now()) {
		delete data.iat;
		let token = auth.login(data);
		res.header('Set-Cookie', `auth=${token}; expires=${new Date(Date.now() + 60 * 60 * 24 * 7 * 1000).toUTCString()}; path=/; overwrite=true;`);
	}
	next();
});

router.get('/survey/list', async (req, res) => {
	res.status(200).end(JSON.stringify({
		result: 0,
		result_data: (await Promise.all((await db.getSurveyCollection().find({}).toArray()).map(async (obj) => {
			let submitted = await db.isSubmitted(req.stu_info.num, obj.id);
			let permChk = obj.permission.includes(req.stu_info.num.substr(0, 1));
			let oldSurvey = Date.now() >= obj.endDate;
			if (!permChk) return null;
			if (oldSurvey) return null;
			return {
				name: obj.name,
				url: obj.id,
				desc: obj.desc,
				disabled: submitted || !permChk || oldSurvey,
				error: (submitted ? "이미 제출한 설문입니다." : (!permChk ? "제출할 수 없는 설문입니다.\n다른 학년의 설문입니다." : (oldSurvey ? "설문 기간이 지났습니다." : null))),
				startDate: obj.startDate,
				endDate: obj.endDate
			};
		}))).filter(obj => obj !== null)
	}));
});

router.get('/survey/detail', async (req, res) => {
	let {id} = req.query;
	if (typeof id !== "string") {
		res.status(400).end(JSON.stringify({
			result: 400
		}));
		return;
	}
	let data = await db.getSurveyCollection().findOne({id});
	if (data === null) {
		res.status(400).end(JSON.stringify({
			result: 400
		}));
		return;
	}
	let permChk = data.permission.includes(req.stu_info.num.substr(0, 1));
	if (!permChk) {
		res.status(400).end(JSON.stringify({
			result: 400
		}));
		return;
	}

	delete data._id;
	for (let {ans} of data.quest) {
		for (let menu of ans) {
			menu.text = menu.value;
			if (menu.count === -1) continue;
			if (menu.count <= 0) {
				menu.disabled = true;
				menu.text += ` (마감됨)`;
			} else {
				menu.disabled = false;
				menu.text += ` (${menu.count}명 남음)`;
			}
		}
	}

	res.status(200).end(JSON.stringify({
		result: 0,
		result_data: data.quest
	}));
});

router.post('/survey/submit', queue({activeLimit: 1, queuedLimit: -1}), async (req, res) => {
	try {
		let {id, data} = req.body;
		if (typeof id !== "string" || typeof data !== "object") throw new Error();
		for (let key of Object.keys(data)) {
			if (typeof key !== "string") throw new Error();
			for (let ans of data[key])
				if (typeof ans !== "string") throw new Error();
		}

		let ret = await db.writeStudentSurvey(req.stu_info.num, id, data);
		if (ret !== true) throw new Error();
		res.status(200).end(JSON.stringify({
			result: 0,
		}, null, 4));
	} catch (e) {
		res.status(400).end(JSON.stringify({
			result: 400,
		}, null, 4));
	}
});

router.get('/survey/result', async (req, res) => {
	if (req.stu_info.num !== "admin") {
		res.status(403).end(JSON.stringify({
			result: 403,
		}, null, 4));
		return;
	}

	let group_by, ans_by;
	{
		let stu = await db.getStudentCollection().find({}).toArray();
		let survey = await db.getSurveyCollection().find({}).toArray();
		let ret = {};
		for (let {id, name, quest} of survey) {
			ret[id] = {
				id,
				name,
				quest: {}
			};
			for (let {id: questId, ans} of quest) {
				for (let {value, count} of ans) {
					ret[id].quest[value] = {
						value: value,
						count: count,
						students: []
					};
				}
			}
		}

		for (let {num, submitted} of stu) {
			for (let surveyId of Object.keys(submitted)) {
				let surveyRes = submitted[surveyId];
				for (let id of Object.keys(surveyRes)) {
					for (let questRes of surveyRes[id]) {
						if (ret[surveyId] === undefined || ret[surveyId].quest[questRes] === undefined) continue;
						ret[surveyId].quest[questRes].students.push({
							num,
							name: student.findByNum(num).name
						});
					}
				}
			}
		}

		for (let key of Object.keys(ret))
			for (let key2 of Object.keys(ret[key].quest))
				ret[key].quest[key2].students.sort((a, b) => parseInt(a.num) - parseInt(b.num));

		ans_by = ret;
	}

	{
		let stu = await db.getStudentCollection().find({}).toArray();
		let mp = {};
		for (let {num, submitted} of stu) {
			mp[num] = {};
			for (let id of Object.keys(submitted)) mp[num][id] = Object.values(submitted[id]).map(arr => arr.join(", ")).filter(arr => arr.length > 0).join(", ");
		}

		let survey = await db.getSurveyCollection().find({}).toArray();
		let ret = {};
		for (let {id, name, permission} of survey) {
			ret[id] = {
				id,
				name,
				group: {}
			};
			for (let {num, name} of student.getAll()) {
				let grade = num.substr(0, 1);
				let group = num.substr(1, 2);
				if (!permission.includes(grade)) continue;
				let key = `${grade}-${group.substr(0, 1) === "0" ? group.substr(1) : group}`;
				if (ret[id].group[key] === undefined) ret[id].group[key] = {value: key, students: []};
				ret[id].group[key].students.push({
					num,
					name,
					ans: mp[num][id] ?? "-"
				});
			}
		}

		for (let key of Object.keys(ret))
			for (let key2 of Object.keys(ret[key].group))
				ret[key].group[key2].students.sort((a, b) => parseInt(a.num) - parseInt(b.num));

		group_by = ret;
	}


	res.status(200).end(JSON.stringify({
		result: 0,
		result_data: {
			group_by,
			ans_by
		}
	}));
});

router.use((req, res) => res.status(404).end(JSON.stringify({
	result: 404
}, null, 4)));

module.exports = router;