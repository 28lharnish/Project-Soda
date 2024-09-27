const { resolve } = require('path');
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

// Bryce and Matthew were here
console.log("skibidi slicers in project soda code")
console.log("use with statement btw")

async function getLastUserId() {
    return new Promise(async (resolve, reject) => {
        await db.get('SELECT MAX(id) AS lastId FROM users', (err, results) => {
            if (err) reject(err);
            let lastId = (results.lastId != null) ? results.lastId : 0;
            resolve(lastId);
        });
    });
}

async function getUserRooms(userId) {
    return new Promise(async (resolve, reject) => {

        db.all("SELECT * FROM members WHERE userid = ?", [userId], (err, rows) => {
            if (err) {
                reject(err);
            }

            let memberships = rows;

            const getRoomsSQL = "SELECT * FROM rooms WHERE id IN (" + memberships.map(m => "?").join(",") + ")"; // real

            db.all(getRoomsSQL, memberships.map(m => m.roomid), (err, rows) => {
                if (err) {
                    reject(err);
                }
                resolve(rows);
            });
        });

    });
}

async function getLastRoomId() {
    return new Promise(async (resolve, reject) => {
        await db.get('SELECT MAX(id) AS lastId FROM rooms', (err, results) => {
            if (err) reject(err);
            let lastId = (results.lastId != null) ? results.lastId : 0;
            resolve(lastId);
        });
    });
}

async function getRoomById(id) {
    return new Promise(async (resolve, reject) => {
        await db.get("SELECT * FROM rooms WHERE id = ?", [id], (err, row) => {
            if (err) {
                reject(err);
            }

            room = row;
            resolve(room);
        })
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

async function getRoomMembers(roomid){
    return new Promise(async (resolve, reject) => {
        await db.all("SELECT * FROM members WHERE roomid = ?", [roomid], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

async function getMessagesByRoomID(roomid){
    return new Promise(async (resolve, reject) => {
        await db.all("SELECT * FROM messages WHERE roomid = ?", [roomid], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
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
    getRoomById,
    getRoomByName,
    getRoomMembers,
    getMessagesByRoomID,
    generateToken
}