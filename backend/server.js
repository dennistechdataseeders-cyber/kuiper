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
      'http://192.168.1.6:5173', 
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
// UNIFIED CORS CONFIGURATION - FIXES PATCH METHOD ISSUE
// =========================================================

// Custom CORS middleware - handles all OPTIONS preflight requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Define allowed origins based on environment
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://192.168.1.105:5173',
    'http://192.168.1.6:5173',
    'https://kuiperapp.co.in',
    'https://www.kuiperapp.co.in'
  ];
  
  // Set CORS headers for all responses
  if (process.env.NODE_ENV === 'production') {
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', 'https://kuiperapp.co.in');
    }
  } else {
    // In development, allow all origins
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Expose-Headers', 'Content-Length, X-Kuma-Revision');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
    return res.status(204).end();
  }
  
  next();
});

// CORS configuration for the cors package
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.1.105:5173',
      'http://192.168.1.6:5173',
      'https://kuiperapp.co.in',
      'https://www.kuiperapp.co.in'
    ];
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Apply cors middleware
app.use(cors(corsOptions));

// REMOVED: app.options('*', cors(corsOptions)); - This was causing the error
// The custom middleware above already handles OPTIONS requests

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