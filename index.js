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
app.post("/upload/image", (req, res) => {
    uploadMem(req, res, (err) => {
        if (err) {
            console.error(err)
            res.statusCode = 400;
            return res.end(err.message);
        }
        const { files, body } = req;
        const response = { files };
        const now = Date.now();
        if (body.withThumbnail) {
            response.files.forEach((f) => {
                f.thumbnailPath = makeThumbnail(f, now);
                f.path = compressImage(f, 80, now);
            });
        }
        return res.json(response);
    });
});

app.listen(5000, () => {
    console.log("File Server listening on port 5000");
});

function makeThumbnail(file, pathPrefix = Date.now()) {
    const [width, height] = [200, 200];
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const dst = `storage/${pathPrefix}-${basename}.thumb.${ext}`;
    const gmFile = gm(file.buffer);
    gmFile
        .resize(width, height, "^")
        .gravity("Center")
        .extent(width, height)
        .strip()
        .autoOrient()
        .quality(80)
        .write(dst, (err) => {
            if (err)
                return console.error(err);
        });
    return dst;
}

function compressImage(file, quality = 80, pathPrefix = Date.now()) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const dst = `storage/${pathPrefix}-${basename}.${ext}`;
    gm(file.buffer)
        .quality(quality)
        .strip()
        .autoOrient()
        .write(dst, (err) => {
            if (err)
                return console.error(err);
        });
    return dst;
}