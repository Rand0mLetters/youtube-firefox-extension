var express = require("express");
var request = require("request");
var http = require("https");
var YoutubeDlWrap = require('youtube-dl-wrap')

var app = express();
const youtubedl = new YoutubeDlWrap("./youtube-dl.exe");

/*let youtubeDlEventEmitter = youtubedl.exec(["https://www.youtube.com/watch?v=XGCififcST0",
    "-f", "best", "-o", "output.mp4"])
  .on("progress", (progress) => 
    console.log(progress.percent, progress.totalSize, progress.currentSpeed, progress.eta))
  .on("error", (error) => console.error(error))
  .on("close", () => console.log("all done"));*/

app.use(function(req, res, next) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Expose-Headers", 'Content-Length');
	next();
});

app.get("/get-video-info", async function(req, res) {
	console.log("getting data about video " + req.query.video_id);
	const info = await youtubedl.getVideoInfo(req.query.video_id);
	console.log("info sent");
	res.send(info);
});

app.get("/download-video/:target", function(req, res) {
	const targetUrl = decodeURIComponent(req.params.target);
	console.log("request received, url: " + targetUrl);
	http.get(targetUrl, function(response) {
		res.setHeader("Content-Length", response.headers["content-length"]);
		if (response.statusCode >= 400) res.status(500).send("Error");
		console.log("sending data");
		response.on("data", function(chunk) {
			res.write(chunk);
		});
		response.on("error", error => console.log(error));
		response.on("end", function() {
			res.end();
		});
	});
});

app.listen(process.env.PORT || 5000);