// backend/routes/announcementRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
    createAnnouncement,
    getAnnouncements,
    getAnnouncementById,
    toggleLike,
    addComment,
    deleteComment,
    deleteAnnouncement
} = require('../controllers/announcementController');

// ============================================
// MULTER CONFIGURATION FOR IMAGE UPLOADS
// ============================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/announcements');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'announcement-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: fileFilter
});

// ============================================
// HELPER: Get base URL
// ============================================
function getBaseUrl(req) {
    try {
        if (process.env.API_BASE_URL) {
            return process.env.API_BASE_URL.replace(/\/+$/, '');
        }
        if (process.env.FRONTEND_URL) {
            return process.env.FRONTEND_URL.replace(/\/+$/, '');
        }
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.get('host');
        return `${protocol}://${host}`;
    } catch (error) {
        return 'https://api.kuiperapp.co.in';
    }
}

// ============================================
// IMAGE UPLOAD ENDPOINT
// ============================================
router.post('/upload-image', protect, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        const baseUrl = getBaseUrl(req);
        const imageUrl = `${baseUrl}/uploads/announcements/${req.file.filename}`;

        res.json({
            success: true,
            url: imageUrl,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        });

    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// ============================================
// ROUTES - All require authentication
// ============================================
router.use(protect);

// GET all announcements (all authenticated users except Client)
router.get('/', authorize('Super Admin', 'Admin', 'Project Manager', 'Developer', 'Team Lead', 'Sales', 'Sales Manager', 'HR', 'Finance'), getAnnouncements);

// GET single announcement
router.get('/:id', authorize('Super Admin', 'Admin', 'Project Manager', 'Developer', 'Team Lead', 'Sales', 'Sales Manager', 'HR', 'Finance'), getAnnouncementById);

// POST create announcement
router.post('/', authorize('Super Admin', 'Admin', 'Project Manager', 'Developer', 'Team Lead', 'Sales', 'Sales Manager', 'HR', 'Finance'), createAnnouncement);

// POST toggle like
router.post('/:id/like', authorize('Super Admin', 'Admin', 'Project Manager', 'Developer', 'Team Lead', 'Sales', 'Sales Manager', 'HR', 'Finance'), toggleLike);

// POST add comment
router.post('/:id/comments', authorize('Super Admin', 'Admin', 'Project Manager', 'Developer', 'Team Lead', 'Sales', 'Sales Manager', 'HR', 'Finance'), addComment);

// DELETE comment
router.delete('/:announcementId/comments/:commentId', authorize('Super Admin', 'Admin', 'Project Manager', 'Developer', 'Team Lead', 'Sales', 'Sales Manager', 'HR', 'Finance'), deleteComment);

// DELETE announcement
router.delete('/:id', authorize('Super Admin', 'Admin', 'Project Manager', 'Developer', 'Team Lead', 'Sales', 'Sales Manager', 'HR', 'Finance'), deleteAnnouncement);

module.exports = router;