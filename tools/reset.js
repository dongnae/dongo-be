const db = require("../lib/db");
const student = require("../lib/student");

const run = false;
const removeSurvey = false;

(async () => {
	if (run) {
		await db.connect();
		await db.getStudentCollection().deleteMany({});
		await Promise.all(student.getAll().map(async ({num}) => {
			if (await db.getStudentCollection().findOne({num}) === null) {
				db.getStudentCollection().insertOne({
					num,
					submitted: {}
				});
			}
		}));

		if (removeSurvey) {
			await db.getSurveyCollection().deleteMany({});
		}
	}

	console.log('ok');
	process.exit(0);
})();