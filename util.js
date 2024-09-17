const config = require('./config.json');
const sql = require('sqlite3').verbose();
const crypto = require('crypto');
let db = new sql.Database('db/database.db');


function generateToken(){
    return crypto.randomBytes(64).toString('hex');
}

async function setNewUserToken(id, token){
    return new Promise(async (resolve, reject) => {
        await db.run("UPDATE users SET token = ? WHERE id = ?", [token, id], (err) => {
            if (err) {
                reject(err);
            }
            resolve();
        })
    });
}

async function getUserByToken(token) {
    return new Promise(async (resolve, reject) => {
        await db.get("SELECT * FROM users WHERE token = ?", [token], (err, row) => {
            if (err) {
                reject(err);
            }

            user = row;
            resolve(user);
        })
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

async function getUserByID(id) {
    return new Promise(async (resolve, reject) => {
        await db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
            if (err) {
                reject(err);
            }

            user = row;
            resolve(user);
        })
    });
}

async function getLastUserId(){
    return new Promise(async (resolve, reject) => {
        await db.get('SELECT MAX(id) AS lastId FROM users', (err, results) => {
            if (err) reject(err);
            console.log(results);
            const lastId = results.lastId;
            resolve(lastId);
          });
    });
}

module.exports = {
    getUserByUsername,
    getUserByID,
    getUserByToken,
    getLastUserId,
    setNewUserToken,
    generateToken
}