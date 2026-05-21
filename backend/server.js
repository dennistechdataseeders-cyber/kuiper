const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config();
require('./cron/dripCampaignWorker');

// Middleware Imports
const { protect } = require('./middleware/authMiddleware');

// Route Imports
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const leadGenRoutes = require('./routes/leadGenRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const prospectRoutes = require('./routes/prospects');
const developerRoutes = require('./routes/developer');
const pmRoutes = require('./routes/pmRoutes');
const workDescriptionRoutes = require('./routes/workDescriptionRoutes');
const resourceAnalyticsRoutes =  require('./routes/resourceAnalyticsRoutes');
const emailCampaignRoutes = require('./routes/emailCampaignRoutes');

const app = express();

/* =========================================================
   CREATE HTTP SERVER + SOCKET SERVER
========================================================= */

const server = http.createServer(app);

// In server.js, update the Socket.IO configuration

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.1.6:5173',  // Add your frontend IP
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
      /^http:\/\/localhost(:\d+)?$/
    ],
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']  // Add both transports
});

/* =========================================================
   SOCKET CONNECTION
========================================================= */

global.io = io;
app.set('io', io);
io.on('connection', (socket) => {
  console.log('🟢 Socket Connected:', socket.id);

  // JOIN USER ROOM
  socket.on('join-user-room', (userId) => {
    socket.join(userId);
    console.log(`👤 User joined room: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket Disconnected:', socket.id);
  });
});

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);

    // Allow localhost + LAN IPs
    const allowed =
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);

    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS')); 
    }
  },
  credentials: true
}));

/* =========================================================
   ENV VALIDATION
========================================================= */

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ ERROR: MONGO_URI is missing');
  process.exit(1);
}

/* =========================================================
   ROUTES
========================================================= */

// PUBLIC
app.use('/api/auth', authRoutes);

// PROTECTED
app.use('/api/admin', protect, adminRoutes);
app.use('/api/orgs', protect, organizationRoutes);

app.use('/api/leads', protect, leadGenRoutes);
app.use('/api/lead-generation', protect, leadGenRoutes);

app.use('/api/prospects', protect, prospectRoutes);
app.use('/api/dev', protect, developerRoutes);
app.use('/api/pm', protect, pmRoutes);
app.use('/api/dev/worklog',protect,workDescriptionRoutes);
app.use('/api/resource-analytics',  resourceAnalyticsRoutes);
app.use('/api/email-campaign',  emailCampaignRoutes);
/* =========================================================
   TEST ROUTE
========================================================= */

app.get('/', (req, res) => {
  res.send('Keyword Analytics API Running 🚀');
});

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  console.log(`⚠️ 404 => ${req.method} ${req.originalUrl}`);

  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

/* =========================================================
   DATABASE + SERVER START
========================================================= */

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on:`);
      console.log(`➡️ Local:   http://localhost:${PORT}`);
      console.log(`➡️ Network: http://192.168.1.5:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
  });