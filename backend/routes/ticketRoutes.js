const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const ticketController = require('../controllers/ticketController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// All routes require authentication
router.use(protect);

// ============================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================

// Configure multer for file uploads (images + documents)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/tickets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'ticket-' + uniqueSuffix + ext);
  }
});

// File filter - allow images AND documents
// File filter - allow images AND documents
const fileFilter = (req, file, cb) => {
  // Image extensions
  const allowedImageTypes = /jpeg|jpg|png|gif|webp|bmp|svg|ico/;
  // Document extensions - ADDED MORE TYPES
  const allowedDocTypes = /pdf|doc|docx|xls|xlsx|txt|csv|zip|rar|7z|tar|gz|bz2|ppt|pptx|odp|odt|ods|rtf|mp4|avi|mkv|mov|wmv|flv|webm|m4v|mpg|mpeg|mp3|wav|aac|ogg|flac|m4a|wma|json|xml|yaml|yml|ini|cfg|conf|js|jsx|ts|tsx|html|css|scss|sass|py|java|cpp|c|h|php|rb|go|rs|sh|bash|bat|ps1|cmd|exe/;
  
  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedDocTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedImageTypes.test(file.mimetype) ||
                   allowedDocTypes.test(file.mimetype) ||
                   file.mimetype === 'application/octet-stream' || // Allow unknown binary files
                   file.mimetype === 'application/x-msdownload' || // .exe files
                   file.mimetype === 'application/x-rar-compressed' ||
                   file.mimetype === 'application/x-7z-compressed' ||
                   file.mimetype === 'application/x-tar' ||
                   file.mimetype === 'application/gzip';
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
    // For .py, .exe, .bat files that might not have recognized MIME types
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.py', '.exe', '.bat', '.sh', '.bash', '.cmd', '.ps1', '.rar', '.7z', '.tar', '.gz', '.bz2'];
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.originalname}" is not supported. Please upload images, documents, archives, code files, or executables.`));
    }
  }
};

// 50MB max for all files (images are validated separately)
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB max for all files
  },
  fileFilter: fileFilter
});

// ============================================
// FILE UPLOAD ENDPOINTS
// ============================================

// Single file upload endpoint - handles both images and documents
router.post('/upload-file', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Determine file type
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const isImage = imageExtensions.includes(fileExt);
    
    // Check size limits based on file type
    if (isImage && req.file.size > 5 * 1024 * 1024) {
      // Clean up the file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: 'Image files must be less than 5MB' 
      });
    }
    
    // Construct the URL for the uploaded file
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/uploads/tickets/${req.file.filename}`;
    
    // Get file size in MB for response
    const sizeInMB = (req.file.size / (1024 * 1024)).toFixed(2);
    
    res.json({ 
      success: true, 
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      sizeDisplay: `${sizeInMB} MB`,
      type: isImage ? 'image' : 'document',
      extension: fileExt.substring(1)
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Multiple file upload endpoint
router.post('/upload-files', protect, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    const uploadedFiles = [];
    const errors = [];
    
    for (const file of req.files) {
      try {
        // Determine file type
        const fileExt = path.extname(file.originalname).toLowerCase();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const isImage = imageExtensions.includes(fileExt);
        
        // Check size limits based on file type
        if (isImage && file.size > 5 * 1024 * 1024) {
          fs.unlinkSync(file.path);
          errors.push({
            filename: file.originalname,
            error: 'Image files must be less than 5MB'
          });
          continue;
        }
        
        // Construct the URL for the uploaded file
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fileUrl = `${baseUrl}/uploads/tickets/${file.filename}`;
        
        uploadedFiles.push({
          success: true,
          url: fileUrl,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          type: isImage ? 'image' : 'document',
          extension: fileExt.substring(1)
        });
      } catch (err) {
        errors.push({
          filename: file.originalname,
          error: err.message
        });
      }
    }
    
    res.json({
      success: true,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      totalUploaded: uploadedFiles.length,
      totalFailed: errors.length
    });
  } catch (error) {
    console.error('Multiple file upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// Delete file endpoint
router.delete('/delete-file', protect, async (req, res) => {
  try {
    const { filename } = req.body;
    const filePath = path.join(__dirname, '../uploads/tickets', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Legacy: Single image upload endpoint (kept for backward compatibility)
router.post('/upload-image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Validate it's actually an image
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (!imageExtensions.includes(fileExt)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Only image files are allowed' });
    }
    
    // Construct the URL for the uploaded image
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/tickets/${req.file.filename}`;
    
    res.json({ 
      success: true, 
      url: imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      type: 'image'
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Legacy: Delete image endpoint
router.delete('/delete-image', protect, async (req, res) => {
  try {
    const { filename } = req.body;
    const filePath = path.join(__dirname, '../uploads/tickets', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Image deletion error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// ============================================
// TICKET CRUD ROUTES
// ============================================

// Create ticket
router.post('/', ticketController.createTicket);

// Get all tickets (with filters)
router.get('/', ticketController.getTickets);

// Get single ticket by ID
router.get('/:id', ticketController.getTicketById);

// ============================================
// TICKET ACTION ROUTES
// ============================================

// Update ticket status
router.patch('/:id/status', ticketController.updateStatus);

// Assign ticket to user (PM, Admin, Team Lead only)
router.patch('/:id/assign', authorize('Project Manager', 'Admin', 'Team Lead'), ticketController.assignTicket);

// Add comment to ticket
router.post('/:id/comments', ticketController.addComment);

// ============================================
// HELPER ENDPOINTS FOR DROPDOWNS
// ============================================

// Get projects for dropdown (role-based)
router.get('/projects/list', ticketController.getProjects);

// Get feeds for a specific project
router.get('/feeds/:projectId', ticketController.getFeeds);

// Get developers for assignment dropdown (PM, Admin, Team Lead only)
router.get('/developers/list', authorize('Project Manager', 'Admin', 'Team Lead'), ticketController.getDevelopers);

module.exports = router;