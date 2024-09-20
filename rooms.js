const sql = require('sqlite3').verbose();
const config = require('./config.json');

const util = require('./util');

let db = new sql.Database('db/database.db');


async function createNewRoom(roomData) { // just put async everywhere until it works
    return new Promise(async (resolve, reject) => {
        let roomName = roomData.roomName;
        let creator = roomData.creator;
        let iconFile = roomData?.iconFile;
        let iconFiletype = iconFile?.mimetype.split('/')[1];
        let iconFilename = iconFile ? `${String(lastId + 1)}.${pfpFiletype}` : config.defaultPfp;
        let lastId = -1;

        await util.getLastRoomId().then(id => {
            lastId = id;
        });

        if (lastId === -1) {
            reject("Could not get last ID");
        }

        if(iconFile){
            await iconFile.mv(`${__dirname + config.iconUploadPath}/${iconFilename}`);
        }

        let createRoomSQL = `INSERT INTO rooms (name, iconfilename) VALUES (?, ?);`;
        let createMembershipSQL = `INSERT INTO members (roomid, userid) VALUES (?, ?)`;
        let room;
        await db.run(createRoomSQL, [roomName, iconFilename], async (err) => {
            if (err) reject(err);
            await util.getRoomByName(roomName).then(r => {
                room = r;
            });
        });

        if(!room){
            reject("no worky");
        }

        console.log(room);

        await db.run(createMembershipSQL, [room.id, creator.id], async(err) => {
            if(err) reject(err);
            resolve(room);
        });

    });

}

module.exports = {
    createNewRoom
}