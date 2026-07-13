const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// Safely load the cron worker using path resolution to avoid directory boundary issues
try {
  require(path.join(__dirname, 'cron', 'dripCampaignWorker'));
  console.log('⏰ Drip Campaign Worker initialized successfully');
} catch (err) {
  console.log('⚠️ Notice: Cron worker file bypass or path adjusted:', err.message);
}

// =========================================================
// CREATE UPLOADS DIRECTORY STRUCTURE IF NOT EXISTS
// =========================================================

const createUploadsDirectory = () => {
  const uploadDirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads/tickets'),
    path.join(__dirname, 'uploads/profiles'),
    path.join(__dirname, 'uploads/temp')
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

const app = express();
const server = http.createServer(app);

/* =========================================================
   CREATE SOCKET SERVER WITH WEB PRODUCTION CORS RULES
========================================================= */

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.1.3:5173', 
      'http://192.168.1.105:5173',
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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    });
  })
  .catch((err) => {
    console.error('❌ Engine Startup Failed. MongoDB Connection Error:', err);
  });