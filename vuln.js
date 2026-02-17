
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE users (id INT, username TEXT, password TEXT, role TEXT, bio TEXT)");
    db.run("INSERT INTO users VALUES (1, 'admin', 'SuperSecret123!', 'admin', 'I am the boss')");
    db.run("INSERT INTO users VALUES (2, 'guest', 'guest123', 'user', 'Just a visitor')");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());

const SECRET_KEY = "MY_SUPER_SECRET_KEY_DONT_TELL_ANYONE";

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";

    db.get(query, (err, row) => {
        if (row) {
            res.send("Welcome " + row.username + ". Your token: " + Buffer.from(row.username).toString('base64'));
        } else {
            res.status(401).send("Invalid credentials");
        }
    });
});


app.get('/debug/config', (req, res) => {
    res.json({
        env: process.env,
        db_path: ":memory:",
        server_info: "Node.js " + process.version
    });
});


app.post('/api/network/ping', (req, res) => {
    const targetIp = req.body.ip;
    const exec = require('child_process').exec;

    exec("ping -c 4 " + targetIp, (error, stdout, stderr) => {
        res.send("<pre>" + stdout + "</pre>");
    });
});

app.get('/render', (req, res) => {
    const template = req.query.tpl;
    try {
        const rendered = eval("`" + template + "`");
        res.send(rendered);
    } catch (e) {
        res.send("Error rendering template");
    }
});

app.get('/admin/delete-user', (req, res) => {
    const userId = req.query.id;
    db.run("DELETE FROM users WHERE id = " + userId, (err) => {
        res.send("User deleted if existed.");
    });
});


app.get('/download', (req, res) => {
    const filename = req.query.file;
    const filePath = path.join(__dirname, 'uploads', filename);
    res.sendFile(filePath);
});

app.post('/upload-profile', (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }
    let profilePic = req.files.profilePic;
    profilePic.mv('./uploads/' + profilePic.name, (err) => {
        res.send('File uploaded to /uploads/' + profilePic.name);
    });
});

app.get('/search', (req, res) => {
    const term = req.query.term;
    res.send("<h1>Search results for: " + term + "</h1>");
});

app.get('/profile', (req, res) => {
    res.send(`
        <html>
            <body>
                <div id="username-display"></div>
                <script>
                    const params = new URLSearchParams(window.location.search);
                    const name = params.get('name');
                    // VULNERABILITY: DOM-XSS via innerHTML
                    document.getElementById('username-display').innerHTML = "User: " + name;
                </script>
            </body>
        </html>
    `);
});

app.get('/api/hash', (req, res) => {
    const data = req.query.data;
    const hash = crypto.createHash('md5').update(data).digest('hex');
    res.send("MD5 Hash: " + hash);
});

app.get('/redirect', (req, res) => {
    const url = req.query.url;
    res.redirect(url);
});

app.post('/api/settings', (req, res) => {
    const settings = req.body.settings;
    const userSettings = JSON.parse(settings, (key, value) => {
        if (key === 'setup') return eval(value);
        return value;
    });
    res.send("Settings updated");
});

app.get('/log', (req, res) => {
    const userAction = req.query.action;
    console.log("User performed action: " + userAction);
    res.send("Action logged");
});

app.listen(3000, () => {
    console.log('Vulnerable server running on port 3000');
});