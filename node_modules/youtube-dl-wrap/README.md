# youtube-dl-wrap

![](https://github.com/ghjbnm/youtube-dl-wrap/workflows/CI%20tests/badge.svg)
<a href="https://npmjs.org/package/youtube-dl-wrap" title="View this project on NPM"><img src="https://img.shields.io/npm/v/youtube-dl-wrap.svg" alt="NPM version" /></a>

A simple node.js wrapper for [youtube-dl](https://github.com/ytdl-org/youtube-dl).

* 0 dependencies
* EventEmitter, Promise and Stream interface
* Progress events
* Utility functions

## Installation

You can install youtube-dl-wrap via npm (`npm i youtube-dl-wrap`).  
Youtube-dl itself will not be automatically downloaded.  
Provide it yourself or use some of the following functions to download the binary.

```javascript
const YoutubeDlWrap = require("youtube-dl-wrap");

//Get the data from the github releases API. In this case get page 1 with a maximum of 5 items.
let githubReleasesData = await YoutubeDlWrap.getGithubReleases(1, 5);

//Download the youtube-dl binary for the given version and platform to the provided path.
//By default the latest version will be downloaded to "./youtube-dl" and platform = os.platform().
await YoutubeDlWrap.downloadFromGithub("path/to/youtube-dl/binary", "2020.06.16.1", "win32");

//Same as above but always downloads the latest version from the youtube-dl website.
await YoutubeDlWrap.downloadFromWebsite("path/to/youtube-dl/binary", "win32");

//Init an instance with a given binary path.
//If none is provided "youtube-dl" will be used as command.
const youtubeDlWrap = new YoutubeDlWrap("path/to/youtube-dl/binary");
//The binary path can also be changed later on.
youtubeDlWrap.setBinaryPath("path/to/another/youtube-dl/binary");
```

## Usage

### EventEmitter

Excecute youtube-dl and returns an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter).  
The `youtubeDlEvent` event will expose all youtube-dl events, for example:  
The log message `[download] Destination: output.mp4` will emit the event type `download` and the event data `Destination: output.mp4`.  
`youtubeDlEmitter.youtubeDlProcess` exposes the spawned youtube-dl process.

```javascript
const YoutubeDlWrap = require("youtube-dl-wrap");
const youtubeDlWrap = new YoutubeDlWrap("path/to/youtube-dl/binary");

let youtubeDlEventEmitter = youtubeDlWrap.exec(["https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    "-f", "best", "-o", "output.mp4"])
  .on("progress", (progress) => 
    console.log(progress.percent, progress.totalSize, progress.currentSpeed, progress.eta))
  .on("youtubeDlEvent", (eventType, eventData) => console.log(eventType, eventData));
  .on("error", (error) => console.error(error))
  .on("close", () => console.log("all done"));

console.log(youtubeDlEventEmitter.youtubeDlProcess.pid);
```

### Readable Stream

Excecute youtube-dl and returns an [Readable Stream](https://nodejs.org/api/stream.html#stream_class_stream_readable).  
The interface works just like the [EventEmitter](#EventEmitter).

```javascript
let readableStream = youtubeDlWrap.execStream(["https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    "-f", "best[ext=mp4]"])
readableStream.pipe(fs.createWriteStream("test.mp4"));
```

### Promise

Excecute youtube-dl and returns an [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).  

```javascript
let stdout = await youtubeDlWrap.execPromise(["https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    "-f", "best", "-o", "output.mp4"]);
console.log(stdout);
```

### Options and Cancellation

Additionally you can set the options of the spawned process and abort the process.  
The abortion of the spawned process is handled by passing the signal of an [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).

```javascript
let controller = new AbortController();
let youtubeDlEventEmitter = youtubeDlWrap.exec(["https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    "-f", "best", "-o", "output.mp4"], {shell:true, detached:true}, controller.signal);

setTimeout(() => 
{
    controller.abort();
    console.log(youtubeDlEventEmitter.youtubeDlProcess.killed);
}, 500);
```

### Metadata

Returns the youtube-dl `--dump-json` metadata as an object.

```javascript
let metadata = await youtubeDlWrap.getVideoInfo("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
console.log(metadata.title);
```

### Utility functions

Just a few utility functions to get informations.

```javascript
let version = await youtubeDlWrap.getVersion();
let userAgent = await youtubeDlWrap.getUserAgent();
let help = await youtubeDlWrap.getHelp();
let extractors = await youtubeDlWrap.getExtractors();
let extractorDescriptions = await youtubeDlWrap.getExtractorDescriptions();
```

## License
MIT
