const EventEmitter = require("events").EventEmitter
const execFile = require("child_process").execFile;
const fs = require("fs");
const https = require("https");
const os = require("os");
const Readable = require("stream").Readable;
const spawn = require("child_process").spawn;

const progressRegex = /\[download\] *(.*) of ([^ ]*)(:? *at *([^ ]*))?(:? *ETA *([^ ]*))?/;

class YoutubeDlWrap
{
    constructor(binaryPath)
    {
        this.setBinaryPath(binaryPath ? binaryPath : "youtube-dl");
    }

    getBinaryPath()
    {
        return this.binaryPath;
    }

    setBinaryPath(binaryPath)
    {
        this.binaryPath = binaryPath;
    }


    static downloadFile(fileURL, filePath)
    {
        return new Promise(async (resolve, reject) =>
        {
            while(fileURL)
            {
                let response = await new Promise((resolveRequest, rejectRequest) => 
                    https.get(fileURL, (httpResponse) => {
                        httpResponse.on("error", (e) => reject(e));
                        resolveRequest(httpResponse);
                }));

                if(response.headers.location)
                    fileURL = response.headers.location;
                else
                {
                    fileURL = null
                    response.pipe(fs.createWriteStream(filePath));
                    response.on("error", (e) => reject(e));
                    response.on("end", () => response.statusCode == 200 ? resolve(response) : reject(response));
                }
            }
        });
    }

    static async downloadFromWebsite(filePath, platform = os.platform())
    {
        let fileName = platform == "win32" ? "youtube-dl.exe" : "youtube-dl";        
        if(!filePath)
            filePath = "./" + fileName;
        let fileURL = "https://youtube-dl.org/downloads/latest/" + fileName;
        return await YoutubeDlWrap.downloadFile(fileURL, filePath);
    }


    static getGithubReleases(page = 1, perPage = 1)
    {
        return new Promise( (resolve, reject) =>
        {
            const apiURL = "https://api.github.com/repos/ytdl-org/youtube-dl/releases?page=" + page + "&per_page=" + perPage;
            https.get(apiURL, { headers: { "User-Agent": "node" } }, (response) =>
            {
                let resonseString = "";
                response.setEncoding("utf8");
                response.on("data", (body) => resonseString += body);
                response.on("error", (e) => reject(e));
                response.on("end", () => response.statusCode == 200 ? resolve(JSON.parse(resonseString)) : reject(response));
            });
        });
    }

    static async downloadFromGithub(filePath, version, platform = os.platform())
    {
        let fileName = platform == "win32" ? "youtube-dl.exe" : "youtube-dl";
        if(!version)
            version = (await YoutubeDlWrap.getGithubReleases(1, 1))[0].tag_name;
        if(!filePath)
            filePath = "./" + fileName;
        let fileURL = "https://github.com/ytdl-org/youtube-dl/releases/download/" + version + "/" + fileName;
        return await YoutubeDlWrap.downloadFile(fileURL, filePath);
    }

    exec(youtubeDlArguments = [], options = {}, abortSignal = null)
    {
        options = YoutubeDlWrap.setDefaultOptions(options);
        const execEventEmitter = new EventEmitter();
        const youtubeDlProcess = spawn(this.binaryPath, youtubeDlArguments, options);
        execEventEmitter.youtubeDlProcess = youtubeDlProcess;
        YoutubeDlWrap.bindAbortSignal(abortSignal, youtubeDlProcess);

        let stderrData = "";
        let processError;
        youtubeDlProcess.stdout.on("data", (data) => YoutubeDlWrap.emitYoutubeDlEvents(data.toString(), execEventEmitter));
        youtubeDlProcess.stderr.on("data", (data) => stderrData += data.toString());
        youtubeDlProcess.on("error", (error) => processError = error);

        youtubeDlProcess.on("close", (code) => {
            if(code === 0 || youtubeDlProcess.killed)
                execEventEmitter.emit("close", code);
            else
                execEventEmitter.emit("error", YoutubeDlWrap.createError(code, processError, stderrData));
        });
        return execEventEmitter;
    }

    execPromise(youtubeDlArguments = [], options = {}, abortSignal = null)
    {
        let youtubeDlProcess;
        const youtubeDlPromise = new Promise((resolve, reject) => 
        {
            options = YoutubeDlWrap.setDefaultOptions(options);
            youtubeDlProcess = execFile(this.binaryPath, youtubeDlArguments, options, (error, stdout, stderr) =>
            {
                if(error)
                    reject(YoutubeDlWrap.createError(error, null, stderr));
                resolve(stdout);
            });
            YoutubeDlWrap.bindAbortSignal(abortSignal, youtubeDlProcess);
        });

        youtubeDlPromise.youtubeDlProcess = youtubeDlProcess;
        return youtubeDlPromise;
    }

    execStream(youtubeDlArguments = [], options = {}, abortSignal = null)
    {
        const readStream = new Readable({ read(size){} });
        options = YoutubeDlWrap.setDefaultOptions(options);
        youtubeDlArguments = youtubeDlArguments.concat(["-o", "-"]);
        const youtubeDlProcess = spawn(this.binaryPath, youtubeDlArguments, options);
        readStream.youtubeDlProcess = youtubeDlProcess;
        YoutubeDlWrap.bindAbortSignal(abortSignal, youtubeDlProcess);

        let stderrData = "";
        let processError;
        youtubeDlProcess.stdout.on("data", (data) => readStream.push(data));
        youtubeDlProcess.stderr.on("data", (data) =>   
        {
            let stringData = data.toString();
            YoutubeDlWrap.emitYoutubeDlEvents(stringData, readStream);
            stderrData += stringData
        });
        youtubeDlProcess.on("error", (error) => processError = error);

        youtubeDlProcess.on("close", (code) =>
        {
            if(code === 0 || youtubeDlProcess.killed)
                readStream.destroy();
            else
                readStream.destroy(YoutubeDlWrap.createError(code, processError, stderrData));
        });
        return readStream;
    }

    async getExtractors()
    {
        let youtubeDlStdout = await this.execPromise(["--list-extractors"]);
        return youtubeDlStdout.split("\n");         
    }

    async getExtractorDescriptions()
    {
        let youtubeDlStdout = await this.execPromise(["--extractor-descriptions"]);
        return youtubeDlStdout.split("\n");         
    }

    async getHelp()
    {
        let youtubeDlStdout = await this.execPromise(["--help"]);
        return youtubeDlStdout;         
    }

    async getUserAgent()
    {
        let youtubeDlStdout = await this.execPromise(["--dump-user-agent"]);
        return youtubeDlStdout;         
    }
    
    async getVersion()
    {
        let youtubeDlStdout = await this.execPromise(["--version"]);
        return youtubeDlStdout;         
    }

    async getVideoInfo(youtubeDlArguments)
    {
        if(typeof youtubeDlArguments == "string")
            youtubeDlArguments = [youtubeDlArguments];
        if(!youtubeDlArguments.includes("-f") && !youtubeDlArguments.includes("--format"))
            youtubeDlArguments = youtubeDlArguments.concat(["-f", "best"]);

        let youtubeDlStdout = await this.execPromise(youtubeDlArguments.concat(["--dump-json"]));
        try{
            return JSON.parse(youtubeDlStdout); 
        }
        catch(e){
            return JSON.parse("[" + youtubeDlStdout.replace(/\n/g, ",").slice(0, -1)  + "]"); 
        }
    }

    static bindAbortSignal(signal, process)
    {
        signal?.addEventListener('abort', () => {
            process.kill();
        });
    }

    static setDefaultOptions(options)
    {
	    if(!options.maxBuffer)
            options.maxBuffer = 1024 * 1024 * 1024;
        return options;
    }

	static createError(code, processError, stderrData)
	{
		let errorMessage = "\nError code: " + code
		if(processError)
			errorMessage += "\n\nProcess error:\n" + processError
		if(stderrData)
			errorMessage += "\n\nStderr:\n" + stderrData
		return new Error(errorMessage);
	}

    static emitYoutubeDlEvents(stringData, emitter)
    {
        let outputLines = stringData.split(/\r|\n/g).filter(Boolean);
        for(let outputLine of outputLines)
        {
            if(outputLine[0] == "[")
            {
                let progressMatch = outputLine.match(progressRegex);
                if(progressMatch)
                {
                    let progressObject = {};
                    progressObject.percent = parseFloat(progressMatch[1].replace("%", ""));
                    progressObject.totalSize = progressMatch[2].replace("~", "");
                    progressObject.currentSpeed = progressMatch[4];
                    progressObject.eta = progressMatch[6];
                    emitter.emit("progress", progressObject);
                }

                let eventType = outputLine.split(" ")[0].replace("[", "").replace("]", "");
                let eventData = outputLine.substring(outputLine.indexOf(" "), outputLine.length);
                emitter.emit("youtubeDlEvent", eventType, eventData);
            }
        }
    }
}

module.exports = YoutubeDlWrap;
