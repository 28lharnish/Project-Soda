const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const cfonts = require('cfonts');
const app = express();
const fs = require('fs')
const sql = require('sqlite3').verbose();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const sanitize = require('sanitize');
const serv = require('http').Server(app);
const registerLogin = require('./registerlogin');
const roomCreation = require('./roomCreation');
const chat = require('./chat');
const util = require('./util');

const PORT = 3000;

const url = 'http://localhost:' + PORT;

const config = require('./config.json');
const { getUnpackedSettings } = require('http2');

const sessionSecret = util.generateToken();

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Ensure cookies are only sent over HTTPS in production
    sameSite: 'Strict', // CSRF protection
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  };

app.set('view engine', 'ejs');
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false
}));
app.use(cookieParser())

const versionNumber = "1.1.0-dev";

app.use('/public', express.static(path.join(__dirname, '/public')));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
serv.listen(PORT, () => {
    console.clear();
    cfonts.say('Project Soda', {
        font: 'simple3d',
        align: 'center',
        colors: ['candy', '#000'],
    });
    cfonts.say(`v${versionNumber}`, {
        font: 'simple3d',
        align: 'center',
        colors: ['#f00', '#000'],
    })
    cfonts.say(`Port - ${PORT}`, {
        font: 'grid',
        align: 'center',
        colors: ['#f00', '#000'],
    })
});

let db = new sql.Database('db/database.db');
db.configure("busyTimeout", 10000); // Wait for 10 seconds before giving up

async function isAuthenticated(req, res, next){

    if(req.session.user){
        next();
        return;
    }

    if(req.cookies.rememberMeToken){
        let user = await util.getUserByToken(req.cookies.rememberMeToken);

        if(user){
            req.session.user = user;
            next();
            return;
        }

    }

    res.redirect(`/login?redirect=${req.url}`);
}


const io = require('socket.io')(serv);
io.on('connection', function (socket) {
    let ip = socket.handshake.address;

    socket.on('message', async function (data) {

        if((!data.text || data.text.length < config.messageRequirements.minLength || data.text.length > config.messageRequirements.maxLength) && data.attachments == ''){
            return
        }
        
        let members = await util.getRoomMembers(data.roomid);

        if(!members.find(m => m.id == data.senderid)){
            return;
        }

        chat.createNewMessage(data.attachments, data.text, data.timestamp, data.roomid, data.senderid).then(async message => {
            message.sender = await util.getUserByID_NO_SENSITIVE_DATA(data.senderid);
            io.emit('message', message);
        });
    });

    socket.on('disconnect', function () {

    });

    socket.on('upload', function (file, filename, callback) {
        let extension = filename.split('.').pop();
        let attachmentID = generateImageID();

        while(fs.existsSync(`./attachments/${attachmentID}.${extension}`)) {
            attachmentID = generateImageID();
        }

        console.log(`Image Uploaded...\n\nFilename: ${filename},\nExtension: ${extension},\nAttachmentID: ${attachmentID}`);

        fs.writeFileSync(`./attachments/${attachmentID}.${extension}`, file, (err) => {});
        callback({ attachmentUrl: `/attachments/${attachmentID}.${extension}` });
    });

    socket.on('deleteMessage', async function(messageId, userId, callback) {
        let dbMessage = await util.getMessageById(messageId);
        if(userId != dbMessage.senderid) return callback({ error: "Message not owned by user." });
        callback({ result: dbMessage })
    });
});


const imageIDLength = 12;
function generateImageID() {
    let imageID = "";
    for(let i=0;i<imageIDLength;i++) {
        imageID += Math.floor(Math.random() * 10);
    }
    return imageID
}

app.get('/attachments/:filename', (req, res) => {
    if(fs.existsSync(path.join(__dirname, `/attachments/${req.params.filename}`))){
        res.sendFile(path.join(__dirname, `/attachments/${req.params.filename}`));
    } else {
        res.status(404).send('File not found.');
        return;
    }
});

app.get('/', isAuthenticated, async (req, res) => {
    console.log(req.originalUrl);

    let ip = req.socket.remoteAddress;
    let rooms = await util.getUserRooms(req.session.user.id);


    let currentRoom;
    let openModal = req.query?.openmodal;
    let modalError = req.query?.modalerror;

    if(req.query?.roomid){

        let members = await util.getRoomMembers(req.query?.roomid);

        console.log(members);

        if(!members.find(m => m.id == req.session.user.id)){
            res.send("You do not have access to this room, buddy");
            return;
        }
        let users = await util.getAllUsers();
        let room = await util.getRoomById(req.query.roomid);
        let messages = await chat.getMessagesByRoomId(req.query.roomid);
        let owner = await util.getUserByID(room.ownerid);

        currentRoom = {
            id: room.id,
            name: room.name,
            icon: room.iconfilepath,
            owner: owner,
            members: members,
            messages: messages
        }

        res.render('main', {
            user: req.session.user, 
            users: users,
            rooms: rooms,
            noRoom: false,
            currentRoom: currentRoom,
            openModal: openModal,
            modalError: modalError,
            cfg: config
        });

        return;
    
    }

    res.render('main', {
        user: req.session.user, 
        rooms: rooms,
        noRoom: true,
        openModal: openModal,
        modalError: modalError,
        cfg: config
    });
});

app.get('/test', async (req, res) => {
    res.render('test')
});

app.get('/funny', isAuthenticated, async (req, res) => {
    res.send('hehehe yup');
});

app.get('/login', async (req, res) => {
    let redirect = req.query?.redirect;
    res.render('login', { error: null, formData: null, redirect: redirect, cfg: config });
});

app.get('/register', async (req, res) => {
    res.render('register', { error: null, formData: null, cfg: config });
});

app.post('/login', async (req, res) => {

    let redirect = req.body?.redirect;
    let username = req.body?.username;
    let rawPass = req.body?.rawPass;
    let rememberMe = req.body?.rememberMe === "checked";

    let formData = {
        username: username,
        rawPass: rawPass,
        rememberMe: rememberMe,
    }

    let error = await registerLogin.isLoginDataValid(formData);

    if (error) {
        res.render('login', { error: error, formData: formData });
        return
    }

    await util.getUserByUsername(formData.username).then(async user => {
        let token = util.generateToken();
        req.session.user = user;

        await util.setNewUserToken(user.id, token);

        if (formData.rememberMe) {
            res.cookie('rememberMeToken', token, cookieOptions);
        } else {
            res.clearCookie('rememberMeToken');
        }
        
        if (redirect) {
            res.redirect(redirect);
        } else {
            res.redirect('/');
        }

    });

});

app.post('/register', async (req, res) => {

    //TODO make pfps optional

    let ip = req.socket.remoteAddress;

    let redirect = req.body?.redirect;
    let username = req.body?.username;
    let rawPass = req.body?.rawPass;
    let pfpFile = req.files?.pfpFile;

    let formData = {
        username: username,
        rawPass: rawPass,
        pfpFile: pfpFile,
    }

    let error = await registerLogin.isRegisterDataValid(formData);

    console.log(error);
    if (error) {
        res.render('register', { error: error, formData: formData });
        console.log("EH I'M ERRORING HERE!");
        return
    }

    registerLogin.createNewUser(formData).then(user => {
        user.password = "";
        req.session.user = user;
        

        if(redirect){
            res.redirect(redirect);
        } else {
            res.redirect("/");
        }

    });
});

app.post("/createroom", isAuthenticated, async (req, res) => {

    const referer = req.get('Referer');

    let name = req.body?.roomName;
    let iconFile = req.files?.iconFile;
    let creator = req.session.user;

    let formData = {
        roomName: name,
        creator: creator,
        iconFile: iconFile
    }

    let error = await roomCreation.isRoomDataValid(formData);

    console.log(error);

    if(error){
        let redirectUrl = util.addParamsToURL(referer, {openmodal: "createRoom", modalerror: error});
        console.log(`redirecting to ${redirectUrl}`);
        res.redirect(redirectUrl);
        return;
    }

    roomCreation.createNewRoom(formData).then(room => {
        console.log(room);
        res.redirect(`/?roomid=${room.id}`);
    });

});

app.post("/addmember", async (req, res) => {

    const referer = req.get('Referer');
    const refererUrl = new URL(referer);

    let roomid = req.body?.roomid;
    let username = req.body?.username;

    let room = await util.getRoomById(roomid);
    let user = await util.getUserByUsername(username);
    let members = await util.getRoomMembers(roomid);

    let error;

    if(!user){
        error = "User does not exist";
    } else if(!room) {
        error = "Room does not exist";
    } else if(members.find(m => m.id === user.id)){
        error = "User already in room, goober";
    } else if(room.ownerid != req.session.user.id){
        error = "bruh";
    }

    if(error){
        let redirectUrl = util.addParamsToURL(referer, {openmodal: "roomMembers", modalerror: error});
        console.log(`redirecting to ${redirectUrl}`);
        res.redirect(redirectUrl);
        return;
    }

    util.addRoomMember(roomid, user.id).then(() => {
        res.redirect(`/?roomid=${roomid}&openmodal=roommembers`);
    });
});

app.post("/kickmember", async (req, res) => {
    const referer = req.get('Referer');
    let roomid = req.body?.roomid;
    let userid = req.body?.userid;

    let room = await util.getRoomById(roomid);

    let error;

    if(!roomid || !userid) {
        error = "Failed to kick user";
    } else if(room.ownerid != req.session.user.id){
        error = "bruh";
    }

    if(error){
        let redirectUrl = util.addParamsToURL(referer, {openmodal: "roomMembers", modalerror: error});
        console.log(`redirecting to ${redirectUrl}`);
        res.redirect(redirectUrl);
        return;
    } 

    util.removeRoomMember(roomid, userid).then(() => {
        res.redirect(referer);
    });
});

//  merry christmas you filthy animal - kevin mcallister 1990 - home alone 2 lost in new york - 1992 - john hughes - chris columbus - macaulay culkin - joe pesci - daniel stern - catherine o'hara - john heard - tim curry - rob schneider - brenda fricker - eddie bracken - dana ivey