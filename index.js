"use strict";

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const gm = require("gm");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, "storage")));

const diskStorage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, "./storage");
    },
    filename: (req, file, callback) => {
        callback(null, `${Date.now()}-${file.originalname}`);
    }
});
const memStorage = multer.memoryStorage();

const maxFiles = 10;
const fileField = "file";
const uploadMem = multer({ storage: memStorage }).array(fileField, maxFiles);
const uploadDisk = multer({ storage: diskStorage }).array(fileField, maxFiles);

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});
app.post("/upload/file", (req, res) => {
    uploadDisk(req, res, (err) => {
        if (err) {
            console.error(err)
            res.statusCode = 400;
            return res.end(err.message);
        }
        const { files, body } = req;
        const response = { files };
        return res.json(response);
    });
});


function _uploadMemWrapper(req, res, onSuccess, onError) {
    uploadMem(req, res, (err) => {
        if (err)
            return onError(err);
        const { files, body } = req;
        const response = { files };
        const now = Date.now();
        let promises = [];
        const thumbs = [];
        response.files.forEach(f => {
            if (body.withThumbnail) {
                promises.push(makeThumbnailPromise(f, now));
                thumbs.push(true);
            }
            promises.push(compressImagePromise(f, 80, now, body.watermark));
            thumbs.push(false);
        });
        Promise.all(promises).then(all => {
            let fileIdx = 0;
            all.forEach((filename, i) => {
                if (thumbs[i]) {
                    response.files[fileIdx].thumbnailPath = filename;
                } else {
                    response.files[fileIdx].path = filename;
                    ++fileIdx;
                }
            });
            onSuccess(response);
        })
            .catch(err => onError(err));
    });
}

function uploadMemPromise(req, res) {
    return new Promise((resolve, reject) => {
        _uploadMemWrapper(req, res, successRes => {
            resolve(successRes);
        }, errorRes => {
            reject(errorRes);
        })
    })
}

app.post("/upload/image", async (req, res) => {
    try {
        const result = await uploadMemPromise(req, res);
        return res.json(result);
    } catch (error) {
        res.statusCode = 400;
        return res.end(result);
    }
});

app.listen(5000, () => {
    console.log("File Server listening on port 5000");
});

function makeThumbnailPromise(file, pathPrefix = Date.now()) {
    return new Promise((resolve, reject) => {
        makeThumbnail(file, (err, data) => {
            if (err)
                reject(err);
            resolve(data);
        }, pathPrefix);
    });
}

function makeThumbnail(file, cb, pathPrefix = Date.now()) {
    const [width, height] = [200, 200];
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const filename = `${pathPrefix}-${basename}.thumb${ext}`;
    const dst = `storage/${filename}`;
    const gmFile = gm(file.buffer);
    gmFile
        .resize(width, height, "^")
        .gravity("Center")
        .extent(width, height)
        .strip()
        .autoOrient()
        .quality(80)
        .write(dst, err => cb(err, filename));
}

function compressImagePromise(file, quality = 80, pathPrefix = Date.now(), watermark = undefined) {
    return new Promise((resolve, reject) => {
        compressImage(file, (err, data) => {
            if (err)
                reject(err);
            resolve(data);
        }, quality, pathPrefix, watermark)
    })
}

function compressImage(file, cb, quality = 80, pathPrefix = Date.now(), watermark = undefined) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const filename = `${pathPrefix}-${basename}${ext}`;
    const dst = `storage/${filename}`;
    const gmObj = gm(file.buffer);
    const maxWidth = 1920;
    gmObj
        .size(function (err, originalSize) {
            if (err)
                return cb(err, null);
            let gmObj2 = gmObj;

            if (watermark) {
                const fontFamily = "Helvetica";
                const deltaRatio = maxWidth / originalSize.width;
                const height = deltaRatio * originalSize.height;
                const ratio = maxWidth / height;
                const fontSize = maxWidth * height / (10_000 * ratio);
                const copyright = "\u00A9";
                watermark = copyright + " " + watermark;
                gmObj2 = gmObj2
                    .fill("#FFFFFFAA")
                    .font(fontFamily, fontSize)
                    .drawText(fontSize, fontSize, watermark, "SouthEast");
            }
            gmObj2
                .resize(maxWidth)
                .quality(quality)
                .strip()
                .autoOrient()
                .write(dst, err => {
                    if (err)
                        return cb(err, null);
                    cb(null, filename);
                });
        });
}