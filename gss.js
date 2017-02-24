var gss = require('google-spreadsheet');
var doc = new gss(/* your public editable google spreadsheet ID */);
var async = require('async');
var fs = require('fs');
var util = require('util');

var cert = require('./cert.json'); // your google account certificate file

var loadSheet = function(callback) {
	console.log('Authentication..');
	doc.useServiceAccountAuth(cert, function(err) {
		if(err) {
			console.log('auth error:'+err);
		} else {
			console.log('Authentication: successed!');
			doc.getInfo(function(err, info) {
				if(err) {
					console.log(err);
					return callback(null);
				}
				console.log('Working sheet information obtained!');
				// console.log('Obtain doc info!'+JSON.stringify(doc,null,' '));
				sheet = info.worksheets[0];
				callback(sheet);
			})
		}
	})

}
/*
	headers:[ token, us, tw, ..]
	data: [
	{
		name: key name
		strings:[]
	},..	]
 */

var uploadData = function(headers, data, cb) {

	loadSheet(function(sheet) {
		if(sheet) {

			async.series([
					function clearTable(callback) {
						console.log('clearing table..');
						sheet.resize({rowCount: 1, colCount: 1}, function(err) {
							sheet.resize({rowCount:1000, colCount:20}, function(err) {
								console.log('table cleared!');
								callback(err);
							})
						})
					},
					function setHeaderRow(callback) {
						sheet.setHeaderRow(headers, callback)
					},
					function getRowsAndUpload(callback) {
						console.log('uploading data, length:'+data.length);
						async.mapLimit(data, 1, function(d, next) {
							var row = {};
							row[headers[0]] = d.name;
							for(var j=0;j<d.strings.length;j++) {
								row[headers[j+1]] = d.strings[j];
							}
							sheet.addRow(row, function(err) {
								if(err)
									console.log('error on add row:'+err);
								else{
									console.log('row uploaded!');
									next();
								}
							})
						}, function() {
							console.log('data uploaded!');
							if(callback)
								callback();
						})
					}
				], function(err) {
					console.log('done!');
					if(cb)
						cb(err);
				})
		}
	})
}
/*
	fds Object
	{
		value: fd
	}
 */


var downloadData = function(callback) {
	loadSheet(function(sheet) {
		sheet.getRows({
			offset:0,
			limit: 1000
		}, function(err, rows) {
			if(err)  {
				console.log('error on getRows:'+err);
			} else {
				console.log('start downloading ..');
				var fds = {};

				var r = rows[0];
				for(var k in r) {
					if(r.hasOwnProperty(k) && k.indexOf('values') >=0) {
						fds[k] = -1;
					}
				}
				initFds(fds)
				for(var i=1;i<rows.length;i++) {
					var row = rows[i];
					var key = row.key|| row.token;
					for(var k in row) {
						if(row.hasOwnProperty(k) && k.indexOf("values") >= 0) {
							if(row[k] && row[k] != '')
								fs.writeFileSync(fds[k], '    <string name="'+key+'">'+row[k]+'</string>\n');
						}
					}
				}
				// write last line of file
				for(var k in fds) {
					if(fds.hasOwnProperty(k) && k.indexOf("values") >=0) {
						fs.writeFileSync(fds[k], '</resources>');
						fs.closeSync(fds[k]);
					}
				}
				console.log('data downloaded!');
				if(callback) {
					callback();
				}
			}
		})
	})
}

var initFds = function (fds) {
	var d = new Date();
	var wd = util.format("%d_%d_%d_%d_%d_%d",d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds());
	fs.mkdirSync("./"+wd);
	for(var key in fds) {
		if(fds.hasOwnProperty(key) && key.indexOf('values') >=0) {
			fs.mkdirSync("./"+wd+"/"+key);
			fds[key] = fs.openSync("./"+wd+"/"+key+"/strings.xml","a+");
			fs.writeFileSync(fds[key], '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n');
		}
	}
}


module.exports.uploadData = uploadData;
module.exports.downloadData = downloadData;
