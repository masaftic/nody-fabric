import { Router } from "express";

import multer from 'multer';
const router = Router();

// Define file filter function to validate file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(null, false);
        cb(new Error('Only image files are allowed!'));
    }
};

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

// Set file size limit to 10MB and apply file type filter
const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter
});

router.post('/', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                // A Multer error occurred when uploading
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File size exceeds limit (10MB)' });
                }
                return res.status(400).json({ error: `Upload error: ${err.message}` });
            } else {
                // An unknown error occurred
                return res.status(400).json({ error: `Upload error: ${err.message}` });
            }
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded or invalid file type' });
        }
        
        return res.json({
            filename: req.file.filename,
            url: `/uploads/${req.file.filename}`
        });
    });
});

router.get('/:filename', (req, res) => {
    const filePath = `./uploads/${req.params.filename}`;
    
    // For images, we can optionally serve them directly instead of downloading
    // This is useful when the frontend wants to display the image
    const { display } = req.query;
    
    if (display === 'true') {
        // Serve the file directly for browser display
        res.sendFile(filePath, { root: process.cwd() }, (err) => {
            if (err) {
                res.status(404).json({ error: 'File not found' });
            }
        });
    } else {
        // Download the file
        res.download(filePath, (err) => {
            if (err) {
                res.status(404).json({ error: 'File not found' });
                return;
            }
            res.end();
        });
    }
});

export {
    router as uploadsRouter
}