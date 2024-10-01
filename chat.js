const config = require('./config.json');
const sql = require('sqlite3').verbose();
let db = new sql.Database('db/database.db');

async function getMessagesByRoomId(roomid){
    return new Promise(async (resolve, reject) => {
        await db.all("SELECT * FROM messages WHERE roomid = ?", [roomid], (err, rows) => {
            if (err) reject(err);
            db.all("SELECT * FROM users WHERE id IN (" + rows.map(r => '?').join(',')+")",rows.map(r => r.senderid), (err, users) => {
                if(err) reject(err);
                for(row in rows){ // it ok
                    let user = users.find(user => user.id == rows[row].senderid);
                    rows[row].sender = user;
                    console.log(rows[row]);
                }
                resolve(rows);
            });
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

async function createNewMessage(text, timestamp, roomid, senderid){
    return new Promise((resolve, reject) => {
        let createMessageSQL = `INSERT INTO messages (text, timestamp, roomid, senderid) VALUES (?, ?, ?, ?)`;
        // bad code don't care just tryna get this done so I can go back to shapes that go
        db.run(createMessageSQL, [text, timestamp, roomid, senderid], async (err) => {
            if(err) reject(err);
            let lastId = await getLastMessageId(roomid);
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