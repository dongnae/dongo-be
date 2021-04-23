const fs = require("fs");

const student = require("../lib/student");
const db = require("../lib/db");

let list = []; //학번
let surveyId = ""; //설문 id

//특정 학번으로 설문에 제출한 응답 취소

db.connect(false).then(async () => {
	let survey = await db.getSurveyCollection().findOne({id: surveyId});
	if (survey === null) {
		console.log('no survey');
		process.exit(0);
		return;
	}

	for (let num of list) {
		let data = await db.getStudentCollection().findOne({num});
		if (data === null) continue;
		if (data.submitted[surveyId] === undefined) continue;
		for (let k of Object.keys(data.submitted[surveyId])) {
			let arr = data.submitted[surveyId][k];
			for (let i = 0; i < survey.quest.length; i++) {
				if (survey.quest[i].id === k) {
					for (let j = 0; j < survey.quest[i].ans.length; j++) {
						if (arr.includes(survey.quest[i].ans[j].value)) {
							if (survey.quest[i].ans[j].count !== -1) ++survey.quest[i].ans[j].count;
						}
					}
				}
			}
		}

		delete data.submitted[surveyId];
		await db.getStudentCollection().findOneAndReplace({num}, data);
	}
	await db.getSurveyCollection().findOneAndReplace({id: surveyId}, survey);

	process.exit(0);
});
