const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Middleware Imports
const { protect } = require('./middleware/authMiddleware');

// Route Imports
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const leadGenRoutes = require('./routes/leadGenRoutes');
const organizationRoutes = require('./routes/organizationRoutes'); 
const prospectRoutes = require('./routes/prospects');
const developerRoutes = require('./routes/developer');
const pmRoutes = require('./routes/pmRoutes'); // Import PM routes properly

const app = express();

// --- 1. Middleware ---
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    // Allow localhost and local network IPs
    const allowed = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// --- 2. Environment Validation ---
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI is not defined in .env");
  process.exit(1); 
}

// --- 3. API Routes ---

app.use('/api/auth', authRoutes); 

// Protected Routes
app.use('/api/admin', protect, adminRoutes); 
app.use('/api/orgs', protect, organizationRoutes); 

// FIX: Point BOTH paths to leadGenRoutes so the frontend doesn't 404
app.use('/api/leads', protect, leadGenRoutes);
app.use('/api/lead-generation', protect, leadGenRoutes); // Add this back!

app.use('/api/prospects', protect, prospectRoutes);
app.use('/api/dev', protect, developerRoutes);
app.use('/api/pm', protect, pmRoutes);
// Root Test Route
app.get('/', (req, res) => {
  res.send("Keyword Analytics API is Running! 🚀");
});

// --- 4. Global 404 Handler (CRITICAL FOR DEBUGGING) ---
// This will catch any request that doesn't match the routes above
app.use((req, res) => {
  console.log(`⚠️  404 - Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    message: `Route ${req.method} ${req.originalUrl} not found on this server.`
  });
});

// --- 5. Database & Server Startup ---
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");

    // Listen on 0.0.0.0 for network access
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`📡 Server running on http://localhost:${PORT}`);
      console.log(`📡 Network access: http://192.168.1.5:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
  });