const { resolve } = require('path');
const config = require('./config.json');
const sql = require('sqlite3').verbose();
const crypto = require('crypto');
let db = new sql.Database('db/database.db');
db.configure("busyTimeout", 10000); // Wait for 10 seconds before giving up


function generateToken() {
    return crypto.randomBytes(64).toString('hex');
}

function addParamsToURL(urlString, params){

    let url = new URL(urlString);
    let urlParams = url.searchParams;

    for (const [key, value] of Object.entries(params)) {
        if (!urlParams.has(key)) {
            urlParams.append(key, value);
        } else if(urlParams.has(key)){
            urlParams.set(key, value);
        }
    }

    return url.toString();
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

async function getAllUsers(){
    return new Promise(async (resolve, reject) => {
        await db.all("SELECT * FROM users", (err, rows) => {
            if (err) {
                reject(err);
            }
            resolve(rows);
        });
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

async function getUserByID_NO_SENSITIVE_DATA(id) {
    return new Promise(async (resolve, reject) => {
        await db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
            if (err) {
                reject(err);
            }

            user = row;
            delete user.password;
            delete user.token;
            resolve(user);
        })
    });
}

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

async function getMessageById(id) {
    return new Promise(async (resolve, reject) => {
        await db.get("SELECT * FROM messages WHERE id = ?", [id], (err, row) => {
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
        db.all("SELECT * FROM members WHERE roomid = ?", [roomid], (err, rows) => {
            if (err) reject(err);
            db.all("SELECT * FROM USERS WHERE id IN (" + rows.map(m => "?").join(",") + ")", rows.map(m => m.userid), (err, rows) => {
                resolve(rows);
            });
        });
    });
}

async function addRoomMember(roomid, userid){
    return new Promise(async (resolve, reject) => {
        db.run("INSERT INTO members (roomid, userid) VALUES (?, ?)", [roomid, userid], (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

async function removeRoomMember(roomid, userid){
    return new Promise(async (resolve, reject) => {
        db.run("DELETE FROM members WHERE roomid = ? AND userid = ?", [roomid, userid], (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

module.exports = {
    addParamsToURL,
    getAllUsers,
    getUserByUsername,
    getUserByID,
    getUserByID_NO_SENSITIVE_DATA,
    getUserByToken,
    getLastUserId,
    setNewUserToken,
    getLastUserId,
    getUserRooms,
    getLastRoomId,
    getRoomById,
    getMessageById,
    getRoomByName,
    getRoomMembers,
    addRoomMember,
    removeRoomMember,
    generateToken
}