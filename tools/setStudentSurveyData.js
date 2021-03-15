const fs = require("fs");
const parse = require("csv-parse/lib/sync");
const assert = require("assert");

const student = require("../lib/student");
const db = require("../lib/db");

let list = [];

for (let obj of parse(fs.readFileSync(__dirname + "/../data/ext_data.csv", "utf-8"), {
	columns: true,
	skip_empty_lines: true,
	trim: true
})) {
	let num = `20${obj['학반']}${obj['번호'].length === 1 ? `0${obj['번호']}` : obj['번호']}`;
	assert(num.length === 5, 'Invalid number.');
	assert(student.findByNum(num) !== null || student.findByNum(num) !== obj['이름'], 'non exist.');
	if (obj['동아리'].trim().length > 0) {
		list.push({
			num: num,
			name: obj['이름'],
			group: obj['동아리'],
		});
	}
}

const survey = JSON.parse(fs.readFileSync(`${__dirname}/../data/survey/group_2021_2.json`, 'utf-8'));
const ids = survey.quest.map(obj => obj.id);

db.connect().then(async () => {
	await Promise.all(list.map(async ({num}) => {
		let student = await db.getStudentCollection().findOne({num});
		if (student === null) return;
		student.submitted[survey.id] = {};
		for (let id of ids) student.submitted[survey.id][id] = [];
		await db.getStudentCollection().findOneAndReplace({num}, student);
	}));

	process.exit(0);
});
