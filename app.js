const express = require('express');
const app = express();
const fs = require('fs')
const sql = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { hash } = require('crypto');
const serv = require('http').Server(app);

const PORT = 3000;

const saltRounds = 10;
const allowedPfpFileExts = ['jpg', 'png', 'webp', 'jfif'];

app.set('view engine', 'ejs');
app.use('/', express.static(__dirname + '/'));
app.use(express.urlencoded({ extended: true }));
serv.listen(PORT);

let db = new sql.Database('db/database.db');

async function createNewUser(userData) { // just put async everywhere until it works
    return new Promise(async (resolve, reject) => {
        let username = userData.username;
        let pfpFileName = userData.pfpFileName;
        let hashedPass;

        await hashPassword(userData.rawPass).then(hash => {
            hashedPass = hash;
        });

        let createUserSQL = `INSERT INTO users (username, password, pfpfilename) VALUES ("${username}", "${hashedPass}", "${pfpFileName}");`;

        db.serialize(() => {
            db.run(createUserSQL, (err) => {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });

    });

}

function hashPassword(rawPass) {
    return new Promise((resolve, reject) => {
        let hashedPass;
        bcrypt.genSalt(saltRounds, (err, salt) => {
            if (err) reject(err);
            bcrypt.hash(rawPass, salt, (err, hash) => {
                if (err) reject(err);
                hashedPass = hash;
                resolve(hashedPass);
            });
        });
    });

}

function isUsernameTaken(username) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id FROM users WHERE username = "${username}"`, (err, row) => {
            if (err) {
                return reject(err);
            }

            resolve(row !== undefined);
        });
    });
}

function isUsernameValid(username) {
    let rules = [username.length >= 3];

    for (rule of rules) {
        if (!rule) return false;
    }


    return true;
}

function isRawPasswordValid(rawPass) {
    let rules = [rawPass.length >= 3];

    for (rule of rules) {
        if (!rule) return false;
    }


    return true;
}

function isPfpValid(pfpFileName) {

    if (pfpFileName.length === 0) {
        return false;
    }

    let fileExt = pfpFileName.split('.');
    fileExt = fileExt[fileExt.length - 1];

    if (!allowedPfpFileExts.includes(fileExt)) {
        return false;
    }

    return true;
}

async function isUserDataValid(userData) {
    let error;
    let usernameTaken;
    await isUsernameTaken(userData.username).then(isTaken => {
        usernameTaken = isTaken;
    });

    //I'm a dirty hypocrite
    if (usernameTaken) {
        error = "USERNAME TAKEN";
    } else if (!isUsernameValid(userData.username)) {
        error = "INVALID USERNAME";
    } else if (!isRawPasswordValid(userData.rawPass)) {
        error = "INVALID PASSWORD";
    } else if (!isPfpValid(userData.pfpFileName)) {
        error = "INVALID PFP";
    } 

    return error;
}

const io = require('socket.io')(serv);
io.on('connection', function (socket) {
    let ip = socket.handshake.address


    socket.on('disconnect', function () {

    });
});

app.get('/', (req, res) => {
    let ip = req.socket.remoteAddress;
    res.render('register');

});

app.get('/chat', (req, res) => {
    res.render('chat', {user: { //FOR TESTING NOT DONE YET
        username: "CHAT"
    }});
});

app.post('/register', async (req, res) => {
    let ip = req.socket.remoteAddress;
    let username = req.body.username;
    let rawPass = req.body.rawPass;
    let pfpFileName = req.body.pfpFileName;

    let userData = {
        username: username,
        rawPass: rawPass,
        pfpFileName: pfpFileName
    }

    console.log(userData);

    let errorCode = await isUserDataValid(userData);

    console.log(errorCode);
    if (errorCode) {
        res.render('register', { previousAttempt: errorCode });
        console.log("EH I'M ERRORING HERE!");
        return
    }

    createNewUser(userData).then(userID => {
        delete userData.rawPass;
        userData.id = userID;
        res.redirect('/chat');
    });
});