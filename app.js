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
const rooms = require('./rooms.js');
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

app.use('/', express.static(__dirname + '/'));
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

    socket.on('disconnect', function () {

    });
});

app.get('/', isAuthenticated, async (req, res) => {
    let ip = req.socket.remoteAddress;
    let rooms = await util.getUserRooms(req.session.user.id);
    let openModal = req.query?.openmodal;
    let modalError = req.query?.modalerror;

    console.log(rooms);

    res.render('main', {
        user: req.session.user, 
        rooms: rooms,
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
        console.log(user);
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

    let name = req.body?.roomName;
    let iconFile = req.files?.iconFile;
    let creator = req.session.user;

    let formData = {
        roomName: name,
        creator: creator,
        iconFile: iconFile
    }

    let error = await rooms.isRoomDataValid(formData);

    console.log(error);

    if(error){
        res.redirect(`/?openmodal=createroom&modalerror=${error}`);
        return;
    }

    rooms.createNewRoom(formData).then(room => {
        res.redirect("/");
    });

});

//  merry christmas you filthy animal - kevin mcallister 1990 - home alone 2 lost in new york - 1992 - john hughes - chris columbus - macaulay culkin - joe pesci - daniel stern - catherine o'hara - john heard - tim curry - rob schneider - brenda fricker - eddie bracken - dana ivey