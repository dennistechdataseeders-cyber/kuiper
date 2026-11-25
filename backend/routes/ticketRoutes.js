const express = require('express');
const { PM_ROLES } = require('../utils/roles');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleCheck');
const ticketController = require('../controllers/ticketController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Feed = require('../models/Feed');

// All routes require authentication
router.use(protect);

// Any logged-in user except Clients (assignment works like watchers: not role-gated)
const blockClients = (req, res, next) => {
  if (req.user && req.user.role === 'Client') {
    return res.status(403).json({ error: 'Clients cannot assign tickets' });
  }
  next();
};

// ============================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================

// Configure multer for file uploads (images + documents)
// Replace the storage configuration with this:

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/tickets');
    // Ensure directory exists with proper permissions
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
        console.log(`📁 Created upload directory: ${uploadDir}`);
      } catch (err) {
        console.error(`❌ Failed to create upload directory: ${err.message}`);
        // Try with sudo if needed - but better to fix permissions manually
      }
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Any file type is allowed, so keep only safe characters (the download route requires them too)
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 20);
    cb(null, 'ticket-' + uniqueSuffix + ext);
  }
});
// File filter - allow all file types
const fileFilter = (req, file, cb) => {
  cb(null, true);
};

// 50MB max for all files (images are validated separately)
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB max for all files
  },
  fileFilter: fileFilter,
  defParamCharset: 'utf8' // keep non-English original filenames readable
});

// Upload errors happen before the route handler runs: answer them as JSON, not Express's HTML 500
const uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    console.error('❌ Ticket upload rejected:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    if (err.code === 'ENOSPC') {
      return res.status(500).json({ error: 'Server disk space full. Please contact support.' });
    }
    if (err.syscall) { // other disk errors: do not expose server paths
      return res.status(500).json({ error: 'Failed to save file on the server.' });
    }
    return res.status(400).json({ error: err.message || 'Failed to upload file' });
  });
};

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
router.post('/upload-file', protect, uploadSingleFile, async (req, res) => {
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
    res.setHeader('X-Content-Type-Options', 'nosniff');
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
// TICKET CRUD ROUTES
// ============================================

// Create ticket
router.post('/', ticketController.createTicket);

// Get all tickets (with filters)
router.get('/', ticketController.getTickets);

// Ticket counts (dashboard cards, sidebar badge, PM dashboard) - must stay above '/:id'
router.get('/stats', ticketController.getTicketStats);

// Get single ticket by ID
router.get('/:id', ticketController.getTicketById);

// ============================================
// TICKET ACTION ROUTES
// ============================================

// Update ticket status
router.patch('/:id/status', ticketController.updateStatus);

// Assign ticket to any non-Client user (open to every non-Client user, like watchers)
router.patch('/:id/assign', blockClients, ticketController.assignTicket);

// Add comment to ticket
router.post('/:id/comments', ticketController.addComment);

// Edit a comment (only its author can edit)
router.patch('/:id/comments/:commentId', ticketController.editComment);

// ============================================
// HELPER ENDPOINTS FOR DROPDOWNS
// ============================================

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

// Get assignable users (every active non-Client user); callable by any non-Client user
router.get('/developers/list', blockClients, ticketController.getDevelopers);

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