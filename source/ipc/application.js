const ipc = require('electron').ipcMain;
const fs = require('fs');
const csv = require('fast-csv');
const dialog = require('electron').dialog;
const constants = require('../constants');

const DONE_MINING = 'DONE_MINING';
const CHECK_PENDING = 'CHECK_PENDING';
const CHECK_KEYS = 'CHECK_KEYS';
const SAVE_KEYS = 'SAVE_KEYS';
const NEW_FILE_IMPORT = 'NEW_FILE_IMPORT';

ipc.on(CHECK_KEYS, function(ipcEvent, data) {
  let result;

  fs.readFile(constants.FILES_PATH + 'config.json', 'utf8', function(err, result) {
    let config = JSON.parse(result);
    if(!config.appKey || !config.appSecret) {
      config.error = "NO_KEYS";
    }

    ipcEvent.sender.send(CHECK_KEYS, config);
  });
});

ipc.on(SAVE_KEYS, function(ipcEvent, keys) {
  let data = {appKey: keys.appKey, appSecret: keys.appSecret, accessToken:"", accessTokenSecret:""};
  fs.writeFile(constants.FILES_PATH + 'config.json', JSON.stringify(data), 'utf8', function (err) {
    let result = {status: 0};
    if(err) {
      result.status = -1;
    }

    ipcEvent.sender.send(SAVE_KEYS, result);
  });
});

ipc.on(DONE_MINING, function(ipcEvent, d) {
  let result = {status: 0};
  let data = {screenName: null, followersCursor: null, lookupPage: null};
  fs.writeFile(constants.FILES_PATH + constants.MINING_STATUS_FILENAME, JSON.stringify(data), 'utf8', function (err) {
    if(err) {
      result.status = -1;
    }

    fs.unlink(constants.FILES_PATH + d.screenName + constants.FOLLOWERS_IDS_FILENAME, function() {
      if(err) {
        result.status = -1;
      }

      ipcEvent.sender.send(DONE_MINING, result);
    });
  });
});

ipc.on(CHECK_PENDING, function(ipcEvent, d) {
  fs.readFile(constants.FILES_PATH + constants.MINING_STATUS_FILENAME, 'utf8', function(err, status) {
    if (err) {
      throw err;
    } else {
      let result = {status: JSON.parse(status)};

      if(result.status.followersCursor !== null || result.status.lookupPage !== null) {
        let followersFileName = constants.FILES_PATH + result.status.screenName + constants.FOLLOWERS_IDS_FILENAME;

        // Read followers IDs file
        fs.readFile(followersFileName, 'utf8', function(err, userIDs) {
          result.userIDs = JSON.parse(userIDs);

          if(fs.existsSync(constants.FILES_PATH + result.status.screenName + constants.USER_LOOKUP_FILENAME)) {
            let userLookupData = [];
            // Read followers details file
            csv.fromPath(constants.FILES_PATH + result.status.screenName + constants.USER_LOOKUP_FILENAME)
            .on('data', function(data) {
              let f = {};

              f.name = data[0];
              f.screen_name = data[1];
              f.url = data[2];

              userLookupData.push(f);
            })
            .on('end', function() {
              result.userLookupData = userLookupData;
              ipcEvent.sender.send(CHECK_PENDING, result);
            });
          } else {
            ipcEvent.sender.send(CHECK_PENDING, result);
          }
        });
      } else {
        ipcEvent.sender.send(CHECK_PENDING, result);
      }
    }
  });
});

ipc.on(NEW_FILE_IMPORT, function(ipcEvent, d) {
  dialog.showOpenDialog(function(fileNames) {
    if(fileNames === undefined) {
      ipcEvent.sender.send(NEW_FILE_IMPORT, {errors: "No file selected"});
    }

    fs.readFile(fileNames[0], 'utf-8', function(err, data) {
      if(err) {
        ipcEvent.sender.send(NEW_FILE_IMPORT, {errors: "Error reading file"});
      }

      var array = data.toString().split(/\r\n?|\n/);

      ipcEvent.sender.send(NEW_FILE_IMPORT, {data: array});
    });
  });
});
