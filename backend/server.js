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
// CREATE UPLOADS DIRECTORY STRUCTURE IF NOT EXISTS
// =========================================================

const createUploadsDirectory = () => {
  const uploadDirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads/tickets'),
    path.join(__dirname, 'uploads/profiles'),
    path.join(__dirname, 'uploads/temp'),
    path.join(__dirname, 'uploads/leads'),
    path.join(__dirname, 'uploads/knowledge')
  ];
  
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
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

const app = express();

// =========================================================
// ✅ TRUST PROXY — REQUIRED BEHIND NGINX
// =========================================================
// Without this, req.protocol always reports 'http' (the protocol
// Nginx uses to talk to Node internally) even when the public site
// is served over https. That bug was causing file URLs saved to the
// database (e.g. comment attachments) to be built as http://... 
// instead of https://..., which then failed to open/download for
// users on the production domain.
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

  // NEW: Join project-specific room
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

  // Leave notifications
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

  // Biometric sync notifications
  socket.on('join-attendance-room', (userId) => {
    socket.join(`attendance_${userId}`);
    console.log(`👤 User joined attendance room: ${userId}`);
  });

  // Emit attendance update to specific user
  socket.on('attendance_updated', (data) => {
    io.to(`attendance_${data.employeeId}`).emit('attendance_updated', data);
    console.log(`📊 Attendance update sent to user: ${data.employeeId}`);
  });

  // Emit sync complete to all users
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

// Check if we're in production
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  // Development - Enable CORS
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
  // Production - COMPLETELY DISABLE CORS IN EXPRESS
  console.log('🚀 Production mode: Express CORS DISABLED');
  console.log('   Nginx handles all CORS headers');
  
  // DO NOT USE cors() middleware in production
  // This middleware removes ALL CORS headers from responses
  app.use((req, res, next) => {
    // Remove ALL CORS headers
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
    
    // For OPTIONS requests, return 204
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    next();
  });
}

// Route static access parameters for uploaded document assets
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Set proper content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
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
      '.js': 'application/javascript',
      '.py': 'text/x-python',
      '.exe': 'application/octet-stream',
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    // For non-images, force download
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
    if (!imageExtensions.includes(ext)) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    }
    
    // CORS headers for file access
    res.setHeader('Access-Control-Allow-Origin', 'https://kuiperapp.co.in');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
  }
}));

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
app.use('/api/leaves', leaveRoutes);

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
      
      // Log all loaded services
      console.log('\n📋 Loaded Services:');
      console.log('  ✅ Drip Campaign Worker');
      console.log('  ✅ Leave Balance Updater');
      console.log('  ✅ Daily Productivity Report');
      console.log('  ✅ Biometric Sync (every 15 minutes)');
      console.log('  ✅ Socket.IO Server');
      console.log('  ✅ REST API Routes');
      console.log('  ✅ File Upload Service');
    });
  })
  .catch((err) => {
    console.error('❌ Engine Startup Failed. MongoDB Connection Error:', err);
  });