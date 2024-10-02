const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const fileUpload = require('express-fileupload');
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

app.use('/public', express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
serv.listen(PORT);

let db = new sql.Database('db/database.db');


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
        chat.createNewMessage(data.text, data.timestamp, data.roomid, data.senderid).then(message => {
            io.emit('message', message);
        });
    });

    socket.on('disconnect', function () {

    });
});

app.get('/', isAuthenticated, async (req, res) => {

    console.log(req.originalUrl);

    let ip = req.socket.remoteAddress;
    let rooms = await util.getUserRooms(req.session.user.id);
    let members = await util.getRoomMembers(req.query.roomid);
    let messages = await chat.getMessagesByRoomId(req.query.roomid);


    let currentRoom;
    let openModal = req.query?.openmodal;
    let modalError = req.query?.modalerror;

    if(req.query?.roomid){
        let room = await util.getRoomById(req.query.roomid);
        let owner = await util.getUserByID(room.ownerid);

        currentRoom = {
            id: room.id,
            name: room.name,
            icon: room.iconfilepath,
            owner: owner,
            members: members,
            messages: messages
        }
    
    }

    res.render('main', {
        user: req.session.user, 
        rooms: rooms,
        currentRoom: currentRoom,
        messages: messages,
        openModal: openModal,
        modalError: modalError,
        cfg: config
    });
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

    console.log("ADDING MEMBER");

    let error;

    if(!room) {
        console.log("Room not found");
        // bad bad I hate it but it worky
        res.redirect(`/?roomid=${roomid}&openmodal=roomMembers&modalerror=Room not found`);
        return;
    }

    if(!user){
        let redirectUrl = util.addParamsToURL(referer, {openmodal: "createRoom", modalerror: error});
        console.log("User not found");
        res.redirect(`/?roomid=${roomid}&openmodal=roomMembers&modalerror=User not found`);
        return;
    }

    if(error){
        //DO THIS
    }

    if(room.ownerid != req.session.user.id){
        console.log("bruh");
        res.send("bruh");
        return;
    }

    util.addRoomMember(roomid, user.id).then(() => {
        res.redirect(`/?roomid=${roomid}`);
    });
});

app.post("/kickmember", (req, res) => {
    let roomid = req.body?.roomid;
    let userid = req.body?.userid;

    util.removeMemberFromRoom(roomid, userid).then(() => {
        res.redirect(req.originalUrl);
    });
});

//  merry christmas you filthy animal - kevin mcallister 1990 - home alone 2 lost in new york - 1992 - john hughes - chris columbus - macaulay culkin - joe pesci - daniel stern - catherine o'hara - john heard - tim curry - rob schneider - brenda fricker - eddie bracken - dana ivey