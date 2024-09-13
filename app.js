const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const fs = require('fs')
const sql = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const sanitize = require('sanitize');
const serv = require('http').Server(app);

const PORT = 3000;

const saltRounds = 10;

const minUsernameLength = 3;
const maxUsernameLength = 20;
const minPasswordLength = 3;
const maxPasswordLength = 20;

const allowedPfpFileFormats = ['jpg', 'png', 'webp', 'jfif'];
const maxPfpFileSize = 2000000; // 3 mb
const pfpUploadPath = __dirname + '/public/attachments/pfp/';

app.set('view engine', 'ejs');
app.use('/', express.static(__dirname + '/'));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
serv.listen(PORT);

let db = new sql.Database('db/database.db');

async function createNewUser(userData) { // just put async everywhere until it works
    return new Promise(async (resolve, reject) => {
        let username = userData.username;
        let pfpFile = userData.pfpFile;
        let pfpFilename = pfpFile.name;
        let pfpFiletype = pfpFile.mimetype.split('/')[1];
        let hashedPass;

        await pfpFile.mv(`${pfpUploadPath}/${username}.${pfpFiletype}`);

        await hashPassword(userData.rawPass).then(hash => {
            hashedPass = hash;
        });

        let createUserSQL = `INSERT INTO users (username, password, pfpfilename) VALUES (?, ?, ?);`;

        db.run(createUserSQL, [username, hashedPass, pfpFilename], (err) => {
            if (err) reject(err);
            resolve(this.lastID);
        });

    });

}

async function getUserByUsername(username) {
    return new Promise(async (resolve, reject) => {
        await db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
            if (err) {
                reject(err);
            }

            user = row;
            resolve(user);
        })
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
        db.get(`SELECT id FROM users WHERE username = ?`, [username], (err, row) => {
            if (err) {
                return reject(err);
            }

            resolve(row !== undefined);
        });
    });
}

function isUsernameValid(username) {
    if (!username) {
        return false;
    }

    let rules = [username.length >= 3, username.length <= maxUsernameLength];

    for (rule of rules) {
        if (!rule) return false;
    }


    return true;
}

function isRawPasswordValid(rawPass) {

    if (!rawPass) {
        return false;
    }

    let rules = [rawPass.length >= minPasswordLength, rawPass.length <= maxPasswordLength];

    for (rule of rules) {
        if (!rule) return false;
    }


    return true;
}

function isPfpValid(pfpFile) {

    if (!pfpFile) {
        return false;
    }

    let rules = [allowedPfpFileFormats.includes(pfpFile.mimetype.split('/')[1]), pfpFile.size < maxPfpFileSize];

    for (rule of rules) {
        if (!rule) return false;
    }

    return true;

}

async function isRegisterDataValid(userData) {
    let error;
    let usernameTaken;

    await isUsernameTaken(userData.username).then(isTaken => {
        usernameTaken = isTaken;
    });

    //I'm a dirty hypocrite
    if (usernameTaken) {
        error = "Username is not available.";
    } else if (!isUsernameValid(userData.username)) {
        error = `Username must be at least ${minUsernameLength} characters long and less than ${maxUsernameLength} characters long.`;
    } else if (!isRawPasswordValid(userData.rawPass)) {
        error = `Password must be at least ${minPasswordLength} characters long and less than ${maxPasswordLength} characters long.`;
    } else if (!isPfpValid(userData.pfpFile)) {
        error = `PFP must be less than ${maxPfpFileSize / 1000000}mb and type `;
        for (i in allowedPfpFileFormats) {
            let ext = allowedPfpFileFormats[i];
            if (i == allowedPfpFileFormats.length - 1) {
                error += " or " + ext;
            } else {
                error += ext + ", "
            }
        }
        error += ".";
    }

    return error;
}

async function isLoginDataValid(userData) {
    let error;
    let userExists;
    await isUsernameTaken(userData.username).then(exists => {
        userExists = exists;
    });

    if (userExists) {
        let user;
        await getUserByUsername(userData.username).then(u => {
            user = u;
        });

        let hashedPass = user.password;

        await bcrypt.compare(userData.rawPass, hashedPass).then(match => {
            if (!match) {
                error = "Wrong-o Password-o.";
            }
        });

    } else {
        error = "You do not exist.";
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
    res.render('chat', {
        user: { //FOR TESTING NOT DONE YET
            username: "CHAT"
        }
    });
});

app.get('/login', async (req, res) => {
    res.render('login');
});

app.get('/register', async (req, res) => {
    res.render('register');
});

app.post('/login', async (req, res) => {
    let username = req.body?.username;
    let rawPass = req.body?.rawPass;
    let rememberMe = req.body?.rememberMe;

    let userData = {
        username: username,
        rawPass: rawPass,
        rememberMe: rememberMe,
    }

    let error = await isLoginDataValid(userData);

    if (error) {
        res.render('login', { error: error });
        return
    }

    res.redirect('/chat');

});

app.post('/register', async (req, res) => {
    let ip = req.socket.remoteAddress;

    let username = req.body?.username;
    let rawPass = req.body?.rawPass;
    let pfpFile = req.files?.pfpFile;



    let userData = {
        username: username,
        rawPass: rawPass,
        pfpFile: pfpFile,
    }

    //console.log(userData);
    let error = await isRegisterDataValid(userData);

    console.log(error);
    if (error) {
        res.render('register', { error: error });
        console.log("EH I'M ERRORING HERE!");
        return
    }

    createNewUser(userData).then(userID => {
        delete userData.rawPass;
        userData.id = userID;
        res.redirect('/chat');
    });
});

//  merry christmas you filthy animal - kevin mcallister 1990 - home alone 2 lost in new york - 1992 - john hughes - chris columbus - macaulay culkin - joe pesci - daniel stern - catherine o'hara - john heard - tim curry - rob schneider - brenda fricker - eddie bracken - dana ivey