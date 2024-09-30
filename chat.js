const config = require('./config.json');
const sql = require('sqlite3').verbose();
let db = new sql.Database('db/database.db');

async function getMessagesByRoomId(roomid){
    return new Promise(async (resolve, reject) => {
        await db.all("SELECT * FROM messages WHERE roomid = ?", [roomid], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
}

async function getLastMessageId(roomid){
    return new Promise(async (resolve, reject) => {
        await db.get("SELECT id FROM messages WHERE roomid = ? ORDER BY id DESC LIMIT 1", [roomid], (err, row) => {
            if (err) reject(err);
            resolve(row.id);
        });
    });
}

async function createNewMessage(messageData){
    return new Promise((resolve, reject) => {
        let createMessageSQL = `INSERT INTO messages (roomid, senderid, content) VALUES (?, ?, ?)`;
        // bad code don't care just tryna get this done so I can go back to shapes that go
        db.run(createMessageSQL, [messageData.roomid, messageData.senderid, messageData.content], async (err) => {
            if(err) reject(err);
            let lastId = await getLastMessageId(messageData.roomid);
            db.get("SELECT * FROM messages WHERE id = ?", [lastId], (err, row) => {
                if(err) reject(err);
                resolve(row);
            });
        })
    });
}

module.exports = {
    getMessagesByRoomId,
    getLastMessageId,
    createNewMessage
}