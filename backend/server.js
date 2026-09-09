// backend/server.js - UPDATED with leaveBucketRoutes

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// =========================================================
// SAFELY LOAD ALL CRON WORKERS
// =========================================================

// Drip Campaign Worker
try {
  require(path.join(__dirname, 'cron', 'dripCampaignWorker'));
  console.log('⏰ Drip Campaign Worker initialized successfully');
} catch (err) {
  console.log('⚠️ Notice: Drip Campaign Worker not loaded:', err.message);
}

// Leave Balance Updater
try {
  require(path.join(__dirname, 'cron', 'leaveBalanceUpdater'));
  console.log('⏰ Leave Balance Updater initialized successfully');
} catch (err) {
  console.log('⚠️ Notice: Leave Balance Updater not loaded:', err.message);
}

// Daily Productivity Report
try {
  require(path.join(__dirname, 'cron', 'dailyProductivityReport'));
  console.log('⏰ Daily Productivity Report initialized successfully');
} catch (err) {
  console.log('⚠️ Notice: Daily Productivity Report not loaded:', err.message);
}

// =========================================================
// ✅ BIOMETRIC SYNC (Every 15 minutes)
// =========================================================
try {
  require(path.join(__dirname, 'cron', 'biometricSync'));
  console.log('⏰ Biometric Sync initialized (every 15 minutes)');
} catch (err) {
  console.log('⚠️ Notice: Biometric Sync not loaded:', err.message);
}

// =========================================================
// ✅ ANNOUNCEMENT AUTOMATION
// =========================================================
try {
  require(path.join(__dirname, 'cron', 'announcementAutomation'));
  console.log('⏰ Announcement Automation initialized successfully');
} catch (err) {
  console.log('⚠️ Notice: Announcement Automation not loaded:', err.message);
}
try {
  require(path.join(__dirname, 'cron', 'holidayReminder'));
  console.log('⏰ Holiday Reminder initialized (daily at 6:00 PM IST)');
} catch (err) {
  console.log('⚠️ Notice: Holiday Reminder not loaded:', err.message);
}

// =========================================================
// ✅ LEAVE BUCKET ACCRUAL CRON
// =========================================================
try {
  require(path.join(__dirname, 'cron', 'leaveBucketAccrual'));
  console.log('⏰ Leave Bucket Accrual initialized (1st of every month)');
} catch (err) {
  console.log('⚠️ Notice: Leave Bucket Accrual not loaded:', err.message);
}

// =========================================================
// CREATE UPLOADS DIRECTORY STRUCTURE IF NOT EXISTS
// =========================================================

const createUploadsDirectory = () => {
  const uploadDirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads/tickets'),
    path.join(__dirname, 'uploads/profiles'),
    path.join(__dirname, 'uploads/temp'),
    path.join(__dirname, 'uploads/leads'),
    path.join(__dirname, 'uploads/knowledge'),
    path.join(__dirname, 'uploads/announcements')
  ];
  
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        console.log(`📁 Created directory: ${dir}`);
      } catch (err) {
        console.error(`❌ Failed to create directory ${dir}:`, err.message);
      }
    } else {
      console.log(`✅ Directory ready: ${dir}`);
    }
  });
};

createUploadsDirectory();

// =========================================================
// ROUTE & MIDDLEWARE DEPENDENCY IMPORTS
// =========================================================

const { protect } = require('./middleware/authMiddleware');

const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const leadGenRoutes = require('./routes/leadGenRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const prospectRoutes = require('./routes/prospects');
const developerRoutes = require('./routes/developer');
const pmRoutes = require('./routes/pmRoutes');
const workDescriptionRoutes = require('./routes/workDescriptionRoutes');
const resourceAnalyticsRoutes = require('./routes/resourceAnalyticsRoutes');
const emailCampaignRoutes = require('./routes/emailCampaignRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const commentRoutes = require('./routes/commentRoutes');
const teamLeadRoutes = require('./routes/teamLeadRoutes');
const ticketAssignmentRoutes = require('./routes/ticketAssignmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const clientRoutes = require('./routes/clientRoutes');
const knowledgeBaseRoutes = require('./routes/knowledgeBaseRoutes');
const hrRoutes = require('./routes/hrRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const holidayRoutes = require('./routes/holidayRoutes');

// ✅ IMPORT THE LEAVE BUCKET ROUTES
let leaveBucketRoutes;
try {
  leaveBucketRoutes = require('./routes/leaveBucketRoutes');
  console.log('✅ Leave Bucket Routes loaded successfully');
} catch (err) {
  console.error('❌ Failed to load Leave Bucket Routes:', err.message);
  leaveBucketRoutes = null;
}

const app = express();

// =========================================================
// ✅ TRUST PROXY — REQUIRED BEHIND NGINX
// =========================================================
app.set('trust proxy', 1);

const server = http.createServer(app);

/* =========================================================
   CREATE SOCKET SERVER WITH WEB PRODUCTION CORS RULES
========================================================= */

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://kuiperapp.co.in',
      'https://www.kuiperapp.co.in',
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      /^http:\/\/localhost(:\d+)?$/
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
  },
  transports: ['websocket', 'polling']
});

/* =========================================================
   GLOBAL SOCKET IO LISTENERS
========================================================= */

global.io = io;
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🟢 Socket Connected:', socket.id);

  socket.on('join-user-room', (userId) => {
    socket.join(userId);
    console.log(`👤 User joined room: ${userId}`);
  });

  socket.on('join-project-room', (projectId) => {
    socket.join(`project_${projectId}`);
    console.log(`📁 User joined project room: ${projectId}`);
  });

  socket.on('leave-project-room', (projectId) => {
    socket.leave(`project_${projectId}`);
    console.log(`📁 User left project room: ${projectId}`);
  });

  socket.on('join-ticket-room', (ticketId) => {
    socket.join(`ticket_${ticketId}`);
    console.log(`🎫 Joined ticket room: ${ticketId}`);
  });

  socket.on('join-leave-room', (userId) => {
    socket.join(`leave_${userId}`);
    console.log(`📋 User joined leave room: ${userId}`);
  });

  socket.on('leave_approved', (data) => {
    io.to(`leave_${data.userId}`).emit('leave_approved', data);
    console.log(`✅ Leave approved notification sent to user: ${data.userId}`);
  });

  socket.on('leave_rejected', (data) => {
    io.to(`leave_${data.userId}`).emit('leave_rejected', data);
    console.log(`❌ Leave rejected notification sent to user: ${data.userId}`);
  });

  socket.on('join-attendance-room', (userId) => {
    socket.join(`attendance_${userId}`);
    console.log(`👤 User joined attendance room: ${userId}`);
  });

  socket.on('attendance_updated', (data) => {
    io.to(`attendance_${data.employeeId}`).emit('attendance_updated', data);
    console.log(`📊 Attendance update sent to user: ${data.employeeId}`);
  });

  socket.on('attendance_sync_complete', (data) => {
    io.emit('attendance_sync_complete', data);
    console.log('📊 Attendance sync complete notification sent to all users');
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket Disconnected:', socket.id);
  });
});

/* =========================================================
   APPLICATION LEVEL MIDDLEWARES
========================================================= */

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =========================================================
// CORS CONFIGURATION - CLEAN SOLUTION
// =========================================================

const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  console.log('🔧 Development mode: CORS enabled');
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });
} else {
  console.log('🚀 Production mode: Express CORS DISABLED');
  console.log('   Nginx handles all CORS headers');
  
  app.use((req, res, next) => {
    const headersToRemove = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods', 
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Credentials',
      'Access-Control-Expose-Headers',
      'Access-Control-Max-Age'
    ];
    
    headersToRemove.forEach(header => {
      res.removeHeader(header);
    });
    
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    next();
  });
}

// =========================================================
// ✅ UPDATED STATIC FILE SERVING WITH BETTER ERROR HANDLING
// =========================================================

// Route static access for uploaded document assets
app.use('/uploads', (req, res, next) => {
  console.log(`📂 Static file request: ${req.path}`);
  console.log(`   Full URL: ${req.protocol}://${req.get('host')}${req.originalUrl}`);
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.js': 'application/javascript',
      '.py': 'text/x-python',
      '.exe': 'application/octet-stream'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    if (!imageExtensions.includes(ext)) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    }
    
    const allowedOrigin = isProduction ? 'https://kuiperapp.co.in' : '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
    
    console.log(`   ✅ Serving file: ${path.basename(filePath)} (${contentType})`);
  }
}));

// Handle 404 for static files
app.use('/uploads', (req, res) => {
  console.log(`❌ File not found: ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'File not found',
    path: req.path,
    message: 'The requested file does not exist on the server'
  });
});

/* =========================================================
   ENV RUNTIME PORT VALIDATIONS
========================================================= */

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ CRITICAL CONFIG ERROR: MONGO_URI string is missing in .env');
  process.exit(1);
}

/* =========================================================
   APPLICATION REST API PIPELINES
========================================================= */

// OPEN ENDPOINTS
app.use('/api/auth', authRoutes);

// CONTROL AUTHORIZED SECURE ENDPOINTS
app.use('/api/admin', protect, adminRoutes);
app.use('/api/orgs', protect, organizationRoutes);
app.use('/api/leads', protect, leadGenRoutes);
app.use('/api/lead-generation', protect, leadGenRoutes);
app.use('/api/prospects', protect, prospectRoutes);
app.use('/api/dev', protect, developerRoutes);
app.use('/api/pm', protect, pmRoutes);
app.use('/api/dev/worklog', protect, workDescriptionRoutes);
app.use('/api/resource-analytics', resourceAnalyticsRoutes);
app.use('/api/email-campaign', emailCampaignRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/comments', protect, commentRoutes);
app.use('/api/teamlead', protect, teamLeadRoutes);
app.use('/api/admin', protect, ticketAssignmentRoutes);
app.use('/api/notifications', protect, notificationRoutes);
app.use('/api/client', protect, clientRoutes);
app.use('/api/knowledge', protect, knowledgeBaseRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/holidays', holidayRoutes);

// =========================================================
// ✅ LEAVE ROUTES - Both old and new systems
// =========================================================

// Old leave routes (for backward compatibility)
app.use('/api/leaves', leaveRoutes);

// New leave bucket routes
if (leaveBucketRoutes) {
  // Use a different path to avoid conflict with old routes
  app.use('/api/leave-bucket', leaveBucketRoutes);
  console.log('✅ Leave Bucket Routes mounted at /api/leave-bucket');
} else {
  console.log('⚠️ Leave Bucket Routes not available');
}

/* =========================================================
   ROOT PIN TEST DIRECTIVE
========================================================= */

app.get('/', (req, res) => {
  res.send('Keyword Analytics Engine Core Production API Operational 🚀');
});

/* =========================================================
   GLOBAL 404 CATCH FALLBACK
========================================================= */

app.use((req, res) => {
  console.log(`⚠️ Route Mismatch 404 Execution => ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Route endpoint ${req.method} ${req.originalUrl} does not exist on server stack`
  });
});

/* =========================================================
   DATABASE INTEGRATION & WEB APPLICATION BOOTSTRAP
========================================================= */

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Cluster Connected Successfully');
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 API System running in production mode listening on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      console.log('\n📋 Loaded Services:');
      console.log('  ✅ Drip Campaign Worker');
      console.log('  ✅ Leave Balance Updater');
      console.log('  ✅ Daily Productivity Report');
      console.log('  ✅ Biometric Sync (every 15 minutes)');
      console.log('  ✅ Announcement Automation');
      console.log('  ✅ Holiday Reminder');
      console.log('  ✅ Leave Bucket Accrual');
      console.log('  ✅ Socket.IO Server');
      console.log('  ✅ REST API Routes');
      console.log('  ✅ File Upload Service');
    });
  })
  .catch((err) => {
    console.error('❌ Engine Startup Failed. MongoDB Connection Error:', err);
  });