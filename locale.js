var fs = require('fs');
var xml2js = require('xml2js');
var async = require('async');
var readline = require('readline');

var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

var parser = new xml2js.Parser();

var PROJECT_PATH = process.env.PRJ_PATH || '.'

var gss = require('./gss.js');

var SupportLangs = [];
var LangJSON = {};
var dirs = fs.readdirSync(PROJECT_PATH);
var DefaultIndex = 0;
var idx = 0;

var EXCEPT_KEY = [/* put the key you don't want to upload */];

var upload = function(done) {

	gss.downloadData(function() {
		console.log("Auto backup done!");
		// extract the support languages by looking for "values-*" array
		for(var i=0;i<dirs.length;i++) {
			var name = dirs[i];
			if(name.indexOf('values') >= 0) {
				SupportLangs.push(name);
				if(name == "values") {
					DefaultIndex = idx;
				}
				idx ++;
			}
		}


		async.map(SupportLangs, function(lang, callback) {
			fs.readFile(PROJECT_PATH+lang+"/"+"strings.xml", function(err, content) {
				if(err) return callback(err);
				console.log('reading strings xml file:'+lang);
				parser.parseString(content, function(err, result) {
					console.log(lang+' table loaded!');
					callback(err, result);
				})
			})
		}, function(err, result) {
			if(err) console.log("Error:"+err);
			else {
				console.log('converting string table..');
				result = convert(result);
				console.log('string table converted!');
				var defaultTbl = result[DefaultIndex];
				// console.log(JSON.stringify(convert(result[0]), null, '  '));

				var headers = [];
				headers.push('key');
				for(var i=0;i<SupportLangs.length;i++) {
					headers.push(SupportLangs[i]);
				}
				var deubgCount = 0;
				var data = [];
				for(var key in defaultTbl) {
					if(defaultTbl.hasOwnProperty(key)) {

						var s = [];

						for(var i=0;i<result.length;i++) {
							s.push(result[i][key]);
						}
						var d = {
							name:key,
							strings: s
						};
						data.push(d);
					}
				}
				gss.uploadData(headers, data, function(err) {
					if(err) console.log('error:'+err);
					if(done)
						done();
				})
			}
		})
	});


	var convert = function(array) {
		/* resources: {
		    string : [
		  			{ _: value
		  			  $: {
		  			  	name: key
		  			  }
		  			}
		  	 ]
		  }
		 */
		var result = [];
		for(var i=0;i<array.length;i++) {
			var r = [];
			var a = array[i]['resources']['string'];
			for(var j=0;j<a.length;j++) {
				var o = a[j];
				if(o.$.name && EXCEPT_KEY.indexOf(o.$.name) < 0) {
					// console.log(o.$)
					r[o.$.name] = o._;
				}
			}
			result.push(r);
		}
		return result;
	}
}

var download = function(done) {
	gss.downloadData(done);
}

rl.question("What action you want to do (u/d/q)? ", function(answer) {
	if(answer == "u") {
		console.log('Start upload data...');
		upload(function() {
			console.log('Data uploaded!');
			process.exit();
		});
	} else if(answer == 'd') {
		console.log('Start download data...');
		download(function() {
			console.log('Data download!');
			process.exit();
		});
	} else if(answer == 'q') {
		console.log("bye");
		process.exit();
	}


})
