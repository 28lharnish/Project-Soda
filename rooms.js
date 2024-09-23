const sql = require('sqlite3').verbose();
const config = require('./config.json');

const util = require('./util');

let db = new sql.Database('db/database.db');


async function createNewRoom(roomData) { // just put async everywhere until it works
    return new Promise(async (resolve, reject) => {
        let roomName = roomData.roomName;
        let owner = roomData.creator;
        let iconFile = roomData?.iconFile;
        let iconFiletype = iconFile?.mimetype.split('/')[1];
        let iconFilename = iconFile ? `${String(lastId + 1)}.${pfpFiletype}` : config.defaultPfp;
        let lastId = -1;

        await util.getLastRoomId().then(id => {
            lastId = id;
        });

        if (iconFile) {
            await iconFile.mv(`${__dirname + config.iconUploadPath}/${iconFilename}`);
        }

        let createRoomSQL = `INSERT INTO rooms (name, iconfilename, ownerid) VALUES (?, ?, ?);`;
        let createMembershipSQL = `INSERT INTO members (userid, roomid) VALUES (?, ?)`;

        let room = await new Promise(async (resolve, reject) => { // I hate async programming
            db.run(createRoomSQL, [roomName, iconFilename, owner.id], async (err) => {
                if (err) reject(err);
                let room = await util.getRoomById(lastId)

                db.run(createMembershipSQL, [owner.id, room.id], async (err) => {
                    if (err) reject(err);
                    resolve(room);
                });

            });
        });
    });

}

module.exports = {
    createNewRoom
}