const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const knowledgeBaseController = require('../controllers/knowledgeBaseController');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/knowledge');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const sanitizedName = file.originalname
      .replace(/[^a-zA-Z0-9.]/g, '_')
      .substring(0, 100);
    cb(null, 'knowledge-' + uniqueSuffix + ext);
  }
});

// File filter - allow all file types
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max per file
  },
  fileFilter: fileFilter
});

// ============================================
// PUBLIC ROUTES (Authenticated users can view)
// ============================================

// Get all entries (with folder filter)
router.get('/', protect, knowledgeBaseController.getEntries);

// Get single entry
router.get('/:id', protect, knowledgeBaseController.getEntry);

// Get all folders
router.get('/folders/list', protect, knowledgeBaseController.getFolders);

// Download file
router.get('/:entryId/download/:fileIndex', protect, knowledgeBaseController.downloadFile);

// ============================================
// ADMIN ONLY ROUTES
// ============================================

// Create entry with files (Admin only)
router.post(
  '/',
  protect,
  authorize('Admin'),
  upload.array('files', 10),
  knowledgeBaseController.createEntry
);

// Update entry (Admin only)
router.put(
  '/:id',
  protect,
  authorize('Admin'),
  upload.array('files', 10),
  knowledgeBaseController.updateEntry
);

// Delete entry (Admin only)
router.delete(
  '/:id',
  protect,
  authorize('Admin'),
  knowledgeBaseController.deleteEntry
);

// Delete specific file (Admin only)
router.delete(
  '/:entryId/file/:fileIndex',
  protect,
  authorize('Admin'),
  knowledgeBaseController.deleteFile
);

module.exports = router;