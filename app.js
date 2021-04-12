const express = require("express");
const https = require("https");
const fs = require("fs");
const app = express();

require('./lib/student');

const auth = require('./lib/auth');
auth.init();

const db = require('./lib/db');
db.connect();

const cors = require("cors");
//app.use(cors());

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const cookieParser = require("cookie-parser");
app.use(cookieParser());

const apiRouter = require("./routes/api");
app.use('/api/', apiRouter);

app.use(express.static(`${__dirname}/static/dist/`));
app.use((req, res) => res.end(fs.readFileSync(`${__dirname}/static/dist/index.html`)));
app.use((req, res) => res.end("error."));

https.createServer({
	cert: fs.readFileSync(`${__dirname}/data/ssl/cert.pem`),
	ca: fs.readFileSync(`${__dirname}/data/ssl/fullchain.pem`),
	key: fs.readFileSync(`${__dirname}/data/ssl/privkey.pem`),
}, app).listen(443);

express().use((req, res) => res.redirect('https://dnhs.me')).listen(80);
