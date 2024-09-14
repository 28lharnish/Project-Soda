const express = require('express');
const path = require('path');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const app = express();
const fs = require('fs')
const sql = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const sanitize = require('sanitize');
const serv = require('http').Server(app);
const registerLogin = require('./registerlogin');
const util = require('./util');

const PORT = 3000;

const conifg = require('./config.json');

app.set('view engine', 'ejs');
app.use(session({
    secret: 'secret key',
    resave: false,
    saveUninitialized: false,
}));

app.use('/', express.static(__dirname + '/'));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
serv.listen(PORT);

let db = new sql.Database('db/database.db');


const io = require('socket.io')(serv);
io.on('connection', function (socket) {
    let ip = socket.handshake.address


    socket.on('disconnect', function () {

    });
});

app.get('/', (req, res) => {
    let ip = req.socket.remoteAddress;
    if(req.session.user){
        res.redirect('/chat');
    } else {
        res.redirect('/login');
    }
    console.log(req.session);
});

app.get('/chat', (req, res) => {

    if(req.session.user){
        res.render('chat', {
            user: req.session.user
        });
    } else {
        res.redirect('/login');
    }
});

app.get('/login', async (req, res) => {
    res.render('login', { error: null, formData: null });
});

app.get('/register', async (req, res) => {
    res.render('register', { error: null, formData: null });
});

app.post('/login', async (req, res) => {
    let username = req.body?.username;
    let rawPass = req.body?.rawPass;
    let rememberMe = req.body?.rememberMe === "checked";

    console.log(rememberMe);

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

    await util.getUserByUsername(formData.username).then(user => {
        req.session.user = user;
        res.redirect('/chat');
    });

});

app.post('/register', async (req, res) => {
    let ip = req.socket.remoteAddress;

    let username = req.body?.username;
    let rawPass = req.body?.rawPass;
    let pfpFile = req.files?.pfpFile;
    console.log(pfpFile);

    let formData = {
        username: username,
        rawPass: rawPass,
        pfpFile: pfpFile,
    }

    //console.log(userData);
    let error = await registerLogin.isRegisterDataValid(formData);

    console.log(error);
    if (error) {
        res.render('register', { error: error, formData: formData });
        console.log("EH I'M ERRORING HERE!");
        return
    }

    registerLogin.createNewUser(formData).then(user => {
        user.password = "ah ah ah, you didn't say the magic word";
        req.session.user = user;
        res.redirect('/chat');
    });
});

//  merry christmas you filthy animal - kevin mcallister 1990 - home alone 2 lost in new york - 1992 - john hughes - chris columbus - macaulay culkin - joe pesci - daniel stern - catherine o'hara - john heard - tim curry - rob schneider - brenda fricker - eddie bracken - dana ivey