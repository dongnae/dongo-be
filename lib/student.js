const fs = require("fs");
const parse = require("csv-parse/lib/sync");

let list = [];

for (let obj of parse(fs.readFileSync(__dirname + "/../data/data.csv", "utf-8"), {
	columns: true,
	skip_empty_lines: true,
	trim: true
})) {
	list.push({
		num: obj['학번'],
		name: obj['이름'],
	});
}

list.push({
	num: 'admin',
	name: fs.readFileSync(__dirname + '/../data/pw.txt')
});

module.exports = {
	findByNum: (num) => {
		let find = list.filter(({num: _num}) => num === _num);
		if (find.length !== 1) return null;
		return find.shift();
	},
	find: (name, num) => {
		let find = list.filter(({name: _name, num: _num}) => name === _name && num === _num);
		if (find.length !== 1) return null;
		return find.shift();
	},
	getAll: () => list,
};
