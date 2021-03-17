const db = require("../lib/db");
const fs = require("fs");

db.connect().then(async () => {
	let surveyCollection = db.getSurveyCollection();
	let data = JSON.parse(fs.readFileSync(`${__dirname}/../data/survey.json`, 'utf-8'));
	if (await surveyCollection.findOne({id: data.id}) !== null) {
		console.log(`${data.id}는 이미 존재합니다.`);
		process.exit(0);
	}
	await surveyCollection.insertOne(data);
	process.exit(0);
});
