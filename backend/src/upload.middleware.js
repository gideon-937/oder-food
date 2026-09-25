import multer from "multer";
import path from "path";

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

    const validMimeType =
        allowedMimeTypes.includes(file.mimetype);

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
    storage: multer.memoryStorage(),

    fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    }
});

export default upload;