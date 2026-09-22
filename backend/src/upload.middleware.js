import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root
const projectRoot = path.join(__dirname, "../../");

// Upload folder
const uploadPath = path.join(
    projectRoot,
    "uploads",
    "food"
);

// Create upload folder if it does not exist
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, {
        recursive: true
    });
}


// ======================================
// STORAGE
// ======================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {

        const extension =
            path.extname(file.originalname).toLowerCase();

        const randomName =
            crypto.randomBytes(16).toString("hex");

        cb(
            null,
            `${randomName}${extension}`
        );
    }

});


// ======================================
// FILE FILTER
// ======================================

const fileFilter = (req, file, cb) => {

    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    const allowedExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ];

    const extension =
        path.extname(file.originalname).toLowerCase();

    // Check MIME type
    const validMimeType =
        allowedMimeTypes.includes(file.mimetype);

    // Check extension
    const validExtension =
        allowedExtensions.includes(extension);

    if (!validMimeType || !validExtension) {

        return cb(
            new Error(
                "Only JPG, JPEG, PNG and WEBP images are allowed."
            ),
            false
        );
    }

    cb(null, true);
};


// ======================================
// MULTER
// ======================================

const upload = multer({

    storage,

    fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    }

});

export default upload;