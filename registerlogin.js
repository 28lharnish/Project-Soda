const config = require('./config.json');
const path = require('path');
const userRequirements = config.userRequirements;
const util = require('./util');
const sql = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

let db = new sql.Database('db/database.db');
db.configure("busyTimeout", 10000); // Wait for 10 seconds before giving up

function hashPassword(rawPass) {
    return new Promise((resolve, reject) => {
        let hashedPass;
        bcrypt.genSalt(config.saltRounds, (err, salt) => {
            if (err) reject(err);
            bcrypt.hash(rawPass, salt, (err, hash) => {
                if (err) reject(err);
                hashedPass = hash;
                resolve(hashedPass);
            });
        });
    });

}

async function createNewUser(userData) { // just put async everywhere until it works
    return new Promise(async (resolve, reject) => {
        let username = userData.username;
        let pfpFile = userData?.pfpFile;
        let pfpFiletype = pfpFile?.mimetype.split('/')[1];
        let hashedPass;
        let lastId = -1;

        await util.getLastUserId().then(id => {
            lastId = id;
        });

        if (lastId === -1) {
            reject("Could not get last ID");
        }

        let pfpFilename = `${String(lastId + 1)}.${pfpFiletype}`;
        let pfpFilepath = pfpFile ? path.join("./", config.pfpUploadPath, pfpFilename) : config.defaultPfp;
        console.log(pfpFilepath);
        if(pfpFile){
            await pfpFile.mv(pfpFilepath);
        }

        await hashPassword(userData.rawPass).then(hash => {
            hashedPass = hash;
        });

        let createUserSQL = `INSERT INTO users (username, password, pfpfilename, token) VALUES (?, ?, ?, ?);`;
        let userToken = util.generateToken();

        await db.run(createUserSQL, [username, hashedPass, pfpFilepath, userToken], async (err) => {
            if (err) reject(err);
            await util.getUserByUsername(username).then(user => {
                resolve(user);
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

    //const regex = new RegExp(`^[${config.userRequirements.allowedUsernameChars}]+$`);

    if (!username) {
        return false;
    }

    //renable after pookie reviews

    /*if(!regex.test(username)){
        return false;
    }*/

    let rules = [username.length >= userRequirements.minUsernameLength, username.length <= userRequirements.maxUsernameLength, ];

    for (rule of rules) {
        if (!rule) return false;
    }


    return true;
}

function isRawPasswordValid(rawPass) {

    if (!rawPass) {
        return false;
    }

    let rules = [rawPass.length >= userRequirements.minPasswordLength, rawPass.length <= userRequirements.maxPasswordLength];

    for (rule of rules) {
        if (!rule) return false;
    }


    return true;
}

function isPfpValid(pfpFile) {

    if (!pfpFile) {
        return true;
    }

    let rules = [userRequirements.allowedPfpFileFormats.includes(pfpFile.mimetype.split('/')[1])];

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
        error = "Username is already taken.";
    } else if (!isUsernameValid(userData.username)) {
        error = `Username must be at least ${userRequirements.minUsernameLength} characters long and less than ${userRequirements.maxUsernameLength} characters long.`;
    } else if (!isRawPasswordValid(userData.rawPass)) {
        error = `Password must be at least ${userRequirements.minPasswordLength} characters long and less than ${userRequirements.maxPasswordLength} characters long.`;
    } else if (!isPfpValid(userData.pfpFile)) {
        error = `PFP must be less than ${userRequirements.maxPfpFileSize / 1000000}mb and type `;
        for (i in userRequirements.allowedPfpFileFormats) {
            let ext = userRequirements.allowedPfpFileFormats[i];
            if (i == userRequirements.allowedPfpFileFormats.length - 1) {
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
        await util.getUserByUsername(userData.username).then(u => {
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

module.exports = {
    createNewUser,
    isLoginDataValid,
    isRegisterDataValid,
    isPfpValid,
    isRawPasswordValid,
    isUsernameValid,
    isUsernameTaken
}