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
        response.files.forEach((f) => {
            if (body.withThumbnail)
                f.thumbnailPath = makeThumbnail(f, now);
            f.path = compressImage(f, 80, now, body.watermark);
        });
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
        .write(dst, (err) => {
            if (err)
                return console.error(err);
        });
    return filename;
}

function compressImage(file, quality = 80, pathPrefix = Date.now(), watermark = undefined) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const filename = `${pathPrefix}-${basename}${ext}`;
    const dst = `storage/${filename}`;
    const gmObj = gm(file.buffer);
    const maxWidth = 1920;
    gmObj
        .size(function (err, originalSize) {
            if (err)
                return console.error(err);
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
                    // .gravity("SouthEast")
                    // .draw([`rotate -25 text ${0},${paddingY} "${watermark}"`])
                    .drawText(fontSize, fontSize, watermark, "SouthEast");
            }
            gmObj2
                .resize(maxWidth)
                .quality(quality)
                .strip()
                .autoOrient()
                .write(dst, (err) => {
                    if (err)
                        return console.error(err);
                });
        });

    return filename;
}