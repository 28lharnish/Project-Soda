const express = require('express');
const app = express();
const fs = require('fs')
const serv = require('http').Server(app);

const sql = require('sqlite3');

const PORT = 3000;
const userDataPath = __dirname+'/user-data.json'
const allowedPfpFileExts = ['jpg','png','webp','jfif'];

app.set('view engine', 'ejs');
app.use('/', express.static(__dirname + '/'));
app.use(express.urlencoded({ extended: true }));
serv.listen(PORT);

let db = new sql.Database('db/users.db');
let users;

fs.readFile(userDataPath, (err, data) => {
    if (err) throw err;
    users = JSON.parse(data);
});

function writeNewUser(userData){
    users.push(userData);

    fs.writeFile(userDataPath, JSON.stringify(users), err => {
        if(err) throw err;

        console.log("Wrote User")
    });
}

function getUser(ip){
    let i = users.findIndex(entry => entry.ip === ip);
    if(i === -1){
        return false;
    }

    return users[i];
}

function userExists(ip){
    return users.some(entry => entry.ip === ip);
}

function usernameValid(username){
    if(!username){
        console.log("BAD USER");
        return false;
    }

    return true;
}

function pfpPathValid(pfpPath){

    if(!pfpPath){
        return false;
    }

    let fileExt = pfpPath.split('.');
    fileExt = fileExt[fileExt.length - 1];

    if(!allowedPfpFileExts.includes(fileExt)){
        return false;
    }

    return true;
}

function userValid(userData){
    let error;
    
    //I'm a dirty hypocrite
    if(userExists(userData.ip)){
        error = "USER EXISTS";
    } else if(!usernameValid(userData.username)){
        error = "INVALID USERNAME";
    } else if(!pfpPathValid(userData.pfpPath)){
        error = "INVALID PFP";
    }

    return error;
}

const io = require('socket.io')(serv);
io.on('connection', function(socket){
    let ip = socket.handshake.address


    socket.on('disconnect', function(){

    });
});

app.get('/', (req, res) => {
    let ip = req.socket.remoteAddress;

    if(userExists(ip)){
        res.render('chat', {userData: getUser(ip)});
    } else {
        res.render('register');
    }

});

app.post('/register', (req, res) => {
    let ip = req.socket.remoteAddress;
    let username = req.body.username;
    let pfpPath = req.body.pfpPath;
    let userData = {
        ip: ip,
        username: username,
        pfpPath: pfpPath
    }
    console.log(userData);

    let errorCode = userValid(userData);

    console.log(errorCode);
    if(errorCode){
        res.render('register', {previousAttempt: errorCode});
        console.log("EH I'M ERRORING HERE!");
        return
    }

    writeNewUser(userData);
    res.render('chat', {user: userData});
});