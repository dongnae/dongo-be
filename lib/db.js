const MongoClient = require('mongodb').MongoClient;
const fs = require("fs");

const student = require("./student");

//survey ->
//  student : 학생의 신청 정보 저장
//  survey : 설문 정보 저장
let db;

const connect = async () => {
		await MongoClient.connect(fs.readFileSync(`${__dirname}/../data/db.txt`, 'utf-8').trim(), {
			useNewUrlParser: true,
			useUnifiedTopology: true
		}).then(async (ret) => {
			db = ret.db('survey');
			await Promise.all(student.getAll().map(async ({num}) => {
				if (await getStudentCollection().findOne({num}) === null) {
					getStudentCollection().insertOne({
						num,
						submitted: {}
					});
				}
			}));
		}).catch(e => {
			console.log("DB Connection Failed");
			console.log(e);
			process.exit(0);
		});
		return db;
	},
	getStudentCollection = () => db.collection('student'),
	getSurveyCollection = () => db.collection('survey'),
	isSubmitted = async (num, id) => {
		let student_data = await getStudentCollection().findOne({num});
		if (student_data === null) return false;
		return student_data.submitted[id] !== undefined;
	},
	writeStudentSurvey = async (num, surveyId, res) => {
		let name = student.findByNum(num);
		if (name === null) return false;

		let student_data = await getStudentCollection().findOne({num});
		if (student_data === null) return false;
		if (student_data.submitted[surveyId] !== undefined) return false;

		let survey_data = await getSurveyCollection().findOne({id: surveyId});
		if (survey_data === null) return false;

		if (!(survey_data.startDate <= Date.now() && Date.now() <= survey_data.endDate)) return false;

		let permChk = survey_data.permission.includes(num.substr(0, 1));
		if (!permChk) return false;

		student_data.submitted[surveyId] = {};
		for (let {id, multiple, ans, required} of survey_data.quest) {
			if (!Array.isArray(res[id])) return false;
			if (required && res[id].length === 0) return false;
			student_data.submitted[surveyId][id] = res[id];
			if (!multiple) student_data.submitted[surveyId][id] = student_data.submitted[surveyId][id].slice(0, 1);

			for (let select of student_data.submitted[surveyId][id]) {
				let valid = false;
				for (let i = 0; i < ans.length; i++) {
					if (ans[i].value !== select) continue;
					valid = true;
					if (ans[i].count === -1) break;
					if (ans[i].count <= 0) return false;
					--ans[i].count;
					break;
				}
				if (!valid) return false; //사용자가 보낸 데이터(form response)가 db에 존재하지 않는 값인 경우
			}
		}

		await getStudentCollection().findOneAndReplace({num}, student_data);
		await getSurveyCollection().findOneAndReplace({id: surveyId}, survey_data);
		return true;
	};

module.exports = {connect, getStudentCollection, getSurveyCollection, isSubmitted, writeStudentSurvey};