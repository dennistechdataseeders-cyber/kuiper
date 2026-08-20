const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const ticketController = require('../controllers/ticketController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Feed = require('../models/Feed');
const User = require('../models/User');

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
const fileFilter = (req, file, cb) => {
  // Image extensions
  const allowedImageTypes = /jpeg|jpg|png|gif|webp|bmp|svg|ico/;
  // Document extensions - ADDED MORE TYPES
  const allowedDocTypes = /pdf|doc|docx|xls|xlsx|txt|csv|zip|rar|7z|tar|gz|bz2|ppt|pptx|odp|odt|ods|rtf|mp4|avi|mkv|mov|wmv|flv|webm|m4v|mpg|mpeg|mp3|wav|aac|ogg|flac|m4a|wma|json|xml|yaml|yml|ini|cfg|conf|js|jsx|ts|tsx|html|css|scss|sass|py|java|cpp|c|h|php|rb|go|rs|sh|bash|bat|ps1|cmd|exe/;
  
  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  allowedDocTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedImageTypes.test(file.mimetype) ||
                   allowedDocTypes.test(file.mimetype) ||
                   file.mimetype === 'application/octet-stream' ||
                   file.mimetype === 'application/x-msdownload' ||
                   file.mimetype === 'application/x-rar-compressed' ||
                   file.mimetype === 'application/x-7z-compressed' ||
                   file.mimetype === 'application/x-tar' ||
                   file.mimetype === 'application/gzip';
  
  if (mimetype && extname) {
    cb(null, true);
  } else {
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
// HELPER FUNCTIONS
// ============================================

/**
 * Get the correct base URL for file uploads
 * Works for both local development and production (VPS with Nginx)
 */
function getBaseUrl(req) {
  try {
    // 1. Check for environment variable (highest priority for production)
    if (process.env.API_BASE_URL) {
      const url = process.env.API_BASE_URL.replace(/\/+$/, '');
      console.log('🔍 Using API_BASE_URL from env:', url);
      return url;
    }
    
    // 2. Check for FRONTEND_URL as fallback
    if (process.env.FRONTEND_URL) {
      const url = process.env.FRONTEND_URL.replace(/\/+$/, '');
      console.log('🔍 Using FRONTEND_URL from env:', url);
      return url;
    }
    
    // 3. Use the request protocol and host
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    
    console.log('🔍 Using request headers:');
    console.log('  - protocol:', protocol);
    console.log('  - host:', host);
    
    // If we're in production but headers are missing, use the API_BASE_URL
    if (process.env.NODE_ENV === 'production' && !host) {
      console.log('⚠️ Production mode but missing host header, using default');
      return 'https://api.kuiperapp.co.in';
    }
    
    if (!host) {
      console.log('⚠️ No host found, using default');
      return 'https://api.kuiperapp.co.in';
    }
    
    return `${protocol}://${host}`;
  } catch (error) {
    console.error('❌ Error in getBaseUrl:', error.message);
    return 'https://api.kuiperapp.co.in';
  }
}

// Get MIME type for file extension
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.py': 'text/x-python',
    '.js': 'application/javascript',
    '.jsx': 'application/javascript',
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.html': 'text/html',
    '.css': 'text/css',
    '.scss': 'text/x-scss',
    '.sass': 'text/x-sass',
    '.java': 'text/x-java',
    '.cpp': 'text/x-c++',
    '.c': 'text/x-c',
    '.h': 'text/x-c',
    '.php': 'text/x-php',
    '.rb': 'text/x-ruby',
    '.go': 'text/x-go',
    '.rs': 'text/x-rust',
    '.sh': 'application/x-sh',
    '.bash': 'application/x-sh',
    '.bat': 'application/x-bat',
    '.ps1': 'application/x-powershell',
    '.cmd': 'application/x-msdos-program',
    '.exe': 'application/octet-stream'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============================================
// FILE UPLOAD ENDPOINTS
// ============================================

// Single file upload endpoint - WITH DETAILED LOGGING
router.post('/upload-file', protect, upload.single('file'), async (req, res) => {
  try {
    console.log('========================================');
    console.log('📤 FILE UPLOAD REQUEST RECEIVED');
    console.log('========================================');
    
    // Log request details for debugging
    console.log('🔍 Request details:');
    console.log('  - Method:', req.method);
    console.log('  - URL:', req.url);
    console.log('  - Headers:', JSON.stringify({
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? 'Bearer [hidden]' : 'none',
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'host': req.get('host'),
      'origin': req.headers['origin']
    }, null, 2));
    
    console.log('🔍 Environment:');
    console.log('  - NODE_ENV:', process.env.NODE_ENV);
    console.log('  - API_BASE_URL:', process.env.API_BASE_URL);
    console.log('  - FRONTEND_URL:', process.env.FRONTEND_URL);
    
    // Check if file exists
    if (!req.file) {
      console.error('❌ No file provided in request');
      return res.status(400).json({ error: 'No file provided' });
    }
    
    console.log('🔍 File info:');
    console.log('  - Original name:', req.file.originalname);
    console.log('  - Size:', req.file.size, 'bytes');
    console.log('  - MIME type:', req.file.mimetype);
    console.log('  - Saved as:', req.file.filename);
    console.log('  - Path:', req.file.path);
    
    // Determine file type
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const isImage = imageExtensions.includes(fileExt);
    
    console.log('🔍 File type:', isImage ? 'Image' : 'Document');
    console.log('  - Extension:', fileExt);
    
    // Check size limits based on file type
    if (isImage && req.file.size > 5 * 1024 * 1024) {
      console.error('❌ Image too large:', req.file.size, 'bytes');
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: 'Image files must be less than 5MB' 
      });
    }
    
    // Get base URL
    console.log('🔍 Getting base URL...');
    let baseUrl;
    try {
      baseUrl = getBaseUrl(req);
      console.log('  - Base URL from getBaseUrl():', baseUrl);
    } catch (urlError) {
      console.error('❌ Error getting base URL:', urlError.message);
      baseUrl = 'https://api.kuiperapp.co.in';
      console.log('  - Using fallback base URL:', baseUrl);
    }
    
    const fileUrl = `${baseUrl}/uploads/tickets/${req.file.filename}`;
    console.log('🔍 Final file URL:', fileUrl);
    
    const sizeInMB = (req.file.size / (1024 * 1024)).toFixed(2);
    
    console.log('✅ File upload successful!');
    console.log('========================================');
    
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
    console.error('========================================');
    console.error('❌ FILE UPLOAD ERROR:');
    console.error('  - Message:', error.message);
    console.error('  - Stack:', error.stack);
    console.error('========================================');
    
    // Check if it's a multer error
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 50MB.' 
      });
    }
    
    // Check if it's a disk space error
    if (error.code === 'ENOSPC') {
      return res.status(500).json({ 
        error: 'Server disk space full. Please contact support.' 
      });
    }
    
    // Generic error
    res.status(500).json({ 
      error: 'Failed to upload file', 
      message: error.message 
    });
  }
});

// Multiple file upload endpoint
router.post('/upload-files', protect, upload.array('files', 10), async (req, res) => {
  try {
    console.log('========================================');
    console.log('📤 MULTIPLE FILE UPLOAD REQUEST RECEIVED');
    console.log('========================================');
    
    if (!req.files || req.files.length === 0) {
      console.error('❌ No files provided');
      return res.status(400).json({ error: 'No files provided' });
    }
    
    console.log(`🔍 ${req.files.length} files received`);
    
    const baseUrl = getBaseUrl(req);
    const uploadedFiles = [];
    const errors = [];
    
    for (const file of req.files) {
      try {
        console.log(`📄 Processing file: ${file.originalname}`);
        console.log(`  - Size: ${file.size} bytes`);
        
        const fileExt = path.extname(file.originalname).toLowerCase();
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const isImage = imageExtensions.includes(fileExt);
        
        if (isImage && file.size > 5 * 1024 * 1024) {
          fs.unlinkSync(file.path);
          errors.push({
            filename: file.originalname,
            error: 'Image files must be less than 5MB'
          });
          continue;
        }
        
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
        
        console.log(`  ✅ Uploaded: ${fileUrl}`);
      } catch (err) {
        console.error(`❌ Error processing file ${file.originalname}:`, err.message);
        errors.push({
          filename: file.originalname,
          error: err.message
        });
      }
    }
    
    console.log(`✅ Upload complete: ${uploadedFiles.length} successful, ${errors.length} failed`);
    console.log('========================================');
    
    res.json({
      success: true,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      totalUploaded: uploadedFiles.length,
      totalFailed: errors.length
    });
  } catch (error) {
    console.error('❌ Multiple file upload error:', error);
    res.status(500).json({ error: 'Failed to upload files', details: error.message });
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

// Legacy: Single image upload endpoint
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
    
    const baseUrl = getBaseUrl(req);
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
// SECURE FILE DOWNLOAD ENDPOINT
// ============================================
router.get('/download/:filename', protect, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security: Prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Sanitize: Only allow alphanumeric, dash, dot, underscore
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9\-_.]/g, '');
    if (sanitizedFilename !== filename) {
      return res.status(400).json({ error: 'Invalid filename format' });
    }
    
    const filePath = path.join(__dirname, '../uploads/tickets', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    
    // Set response headers
    const mimeType = getMimeType(filename);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    console.log(`📥 Downloading file: ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);
    
    // Stream the file to the client
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    
    stream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
    
  } catch (error) {
    console.error('❌ Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download file' });
    }
  }
});

// ============================================
// DEPARTMENT USERS ENDPOINT
// ============================================
router.get('/department-users/:role', protect, async (req, res) => {
  try {
    const { role } = req.params;
    const users = await User.find({ role: role })
      .select('name email _id role')
      .sort({ name: 1 });
    res.json(users);
  } catch (error) {
    console.error('Error fetching department users:', error);
    res.status(500).json({ error: 'Failed to fetch department users' });
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
router.patch('/:id/assign', authorize('Super Admin','Project Manager', 'Admin', 'Team Lead'), ticketController.assignTicket);

// Add comment to ticket
router.post('/:id/comments', ticketController.addComment);

// ============================================
// HELPER ENDPOINTS FOR DROPDOWNS
// ============================================

// Get projects for dropdown (role-based)
router.get('/projects/list', ticketController.getProjects);

router.get('/feeds/:projectId', protect, async (req, res) => {
  try {
    const feeds = await Feed.find({ projectId: req.params.projectId })
      .select('name _id')
      .limit(50);
    
    // Add a "General" option at the beginning for tickets that apply to the whole project
    const response = [
      { _id: 'general', name: '📁 General (Whole Project)' },
      ...feeds
    ];
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({ error: 'Failed to fetch feeds' });
  }
});

// Get developers for assignment dropdown (PM, Admin, Team Lead only)
router.get('/developers/list', authorize('Super Admin','Project Manager', 'Admin', 'Team Lead'), ticketController.getDevelopers);

// ============================================
// WATCHER ROUTES
// ============================================

// Get all users for watcher selection
router.get('/users/watchers', protect, ticketController.getUsersForWatchers);

// Get watchers for a ticket
router.get('/:id/watchers', protect, ticketController.getWatchers);

// Add watcher to ticket
router.post('/:id/watchers', protect, ticketController.addWatcher);

// Remove watcher from ticket
router.delete('/:id/watchers/:userId', protect, ticketController.removeWatcher);

module.exports = router;