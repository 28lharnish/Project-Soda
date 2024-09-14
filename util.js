const config = require('./config.json');
const sql = require('sqlite3').verbose();
let db = new sql.Database('db/database.db');

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
    getLastUserId
}