const config = require('./config.json');
const sql = require('sqlite3').verbose();
const crypto = require('crypto');
let db = new sql.Database('db/database.db');


function generateToken() {
    return crypto.randomBytes(64).toString('hex');
}

async function setNewUserToken(id, token) {
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

async function getLastUserId() {
    return new Promise(async (resolve, reject) => {
        await db.get('SELECT MAX(id) AS lastId FROM users', (err, results) => {
            if (err) reject(err);
            console.log(results);
            const lastId = results.lastId;
            resolve(lastId);
        });
    });
}

async function getUserRooms(userId) {
    let memberships = [];
    let rooms = [];
    return new Promise(async (resolve, reject) => {
        await db.all("SELECT * FROM members WHERE userid = ?", [userId], (err, rows) => {
            if (err) {
                reject(err);
            }

            memberships = rows;
        });

        for (m of memberships) {
            await db.get("SELECT * FROM rooms WHERE id = ?", [m.roomid], (err, row) => {
                if (err) {
                    reject(err);
                }

                rooms.push(row);
            });
        }

        resolve(rooms);

    });
}

async function getLastRoomId() {
    return new Promise(async (resolve, reject) => {
        await db.get('SELECT MAX(id) AS lastId FROM rooms', (err, results) => {
            if (err) reject(err);
            console.log(results);
            const lastId = results.lastId;
            resolve(lastId);
        });
    });
}

async function getRoomByName(name) {
    return new Promise(async (resolve, reject) => {
        await db.get("SELECT * FROM rooms WHERE name = ?", [name], (err, row) => {
            if (err) {
                reject(err);
            }

            resolve(row);
        })
    });
}

module.exports = {
    getUserByUsername,
    getUserByID,
    getUserByToken,
    getLastUserId,
    setNewUserToken,
    getLastUserId,
    getUserRooms,
    getLastRoomId,
    getRoomByName,
    generateToken
}