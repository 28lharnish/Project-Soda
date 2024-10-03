const sql = require('sqlite3').verbose();
const config = require('./config.json');

const util = require('./util');
const roomRequirements = config.roomRequirements;

let db = new sql.Database('db/database.db');
db.configure("busyTimeout", 10000); // Wait for 10 seconds before giving up


async function createNewRoom(roomData) { // just put async everywhere until it works
    return new Promise(async (resolve, reject) => {
        let newID = await util.getLastRoomId() + 1;
        let roomName = roomData.roomName;
        let owner = roomData.creator;
        let iconFile = roomData?.iconFile;
        let iconFiletype = iconFile?.mimetype.split('/')[1];
        let iconFilename = iconFile ? `${String(newId)}.${pfpFiletype}` : config.defaultPfp;
        console.log(`newID: ${newID}`);

        if (iconFile) {
            await iconFile.mv(`${__dirname + config.iconUploadPath}/${iconFilename}`);
        }

        let createRoomSQL = `INSERT INTO rooms (name, iconfilename, ownerid) VALUES (?, ?, ?);`;
        let createMembershipSQL = `INSERT INTO members (userid, roomid) VALUES (?, ?)`;

        let room = await new Promise(async (resolve, reject) => { // I hate async programming
            db.run(createRoomSQL, [roomName, iconFilename, owner.id], async (err) => {
                if (err) reject(err);
                let room = await util.getRoomById(newID)
                let roomID = room.id;

                db.run(createMembershipSQL, [owner.id, roomID], async (err) => {
                    if (err) reject(err);
                    resolve(room);
                });

            });
        });

        resolve(room);
    });

}

async function isRoomNameTaken(roomName) {
    let room = await util.getRoomByName(roomName);

    if (room) {
        return true;
    } else {
        return false;
    }

}

function isRoomNameValid(roomName) {

    const regex = new RegExp(`^[${config.userRequirements.allowedUsernameChars}]+$`);

    if(!roomName){
        return false;
    }

    if(!regex.test(roomName)){
        return false;
    }

    let rules = [roomName.length >= roomRequirements.minRoomnameLength, roomName.length <= roomRequirements.maxRoomnameLength];

    for (rule of rules) {
        if (!rule) return false;
    }

    return true;
}

function isRoomIconValid(iconFile) {
    if (!iconFile) {
        return true;
    }

    let rules = [roomRequirements.allowedIconFileFormats.includes(iconFile.mimetype.split('/')[1])];

    for (rule of rules) {
        if (!rule) return false;
    }

    return true;
}

async function isRoomDataValid(roomData) {
    let error = "";
    let roomNameTaken = await isRoomNameTaken(roomData.roomName);

    if(roomNameTaken){
        error = "Room name is already taken.";
    } else if(!isRoomNameValid(roomData.roomName)){
        error = `Room name must be at least ${roomRequirements.minRoomnameLength} characters long and less than ${roomRequirements.maxRoomnameLength} characters long.`;
    } else if(!isRoomIconValid(roomData.iconFile)){
        error = `Room Icon must be less than ${roomRequirements.maxIconFileSize / 1000000}mb and type `;
        for (i in roomRequirements.allowedIconFileFormats) {
            let ext = roomRequirements.allowedIconFileFormats[i];
            if (i == roomRequirements.allowedIconFileFormats.length - 1) {
                error += " or " + ext;
            } else {
                error += ext + ", "
            }
        }
        error += ".";
    }

    return error;
}

module.exports = {
    createNewRoom,
    isRoomDataValid
}