const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static(path.join(__dirname, "storage")));

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, "./storage");
    },
    filename: (req, file, callback) => {
        callback(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage }).array("file", 10);

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});
app.post("/upload", (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            console.error(err)
            res.statusCode = 400;
            return res.end(err.message);
        }
        const { files } = req;
        return res.json({ files });
    });
});

app.listen(5000, () => {
    console.log("File Server started on port 5000");
});