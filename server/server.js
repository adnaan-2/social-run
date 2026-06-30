require('dotenv').config({ path: '../.env' });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const walkRoutes = require('./routes/walks');
const socialRoutes = require('./routes/social');
const User = require('./models/User');

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Turn off for simpler local Map loading if needed
  })
);
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/walks', walkRoutes);
app.use('/api/social', socialRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'WalkStreak API running',
    timestamp: new Date(),
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ===== SOCKET.IO INTEGRATION =====
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});

const socketUserMap = new Map(); // socket.id -> userId
const userSocketMap = new Map(); // userId -> socket.id

io.on('connection', async (socket) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  let userId = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
      socketUserMap.set(socket.id, userId);
      userSocketMap.set(userId, socket.id);

      // Update user online status
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

      // Notify others
      socket.broadcast.emit('user_online', { userId });
      console.log(`User connected & online: ${userId}`);
    } catch (err) {
      console.error('Socket authentication error:', err.message);
    }
  }

  // Location updating from walk tracking or dashboard map
  socket.on('update_location', async (data) => {
    const uId = socketUserMap.get(socket.id);
    if (!uId) return;

    const { lat, lng } = data;
    if (lat !== undefined && lng !== undefined) {
      await User.findByIdAndUpdate(uId, {
        currentLocation: { type: 'Point', coordinates: [lng, lat] },
        isOnline: true,
        lastSeen: new Date(),
      });

      // Broadcast location updates
      socket.broadcast.emit('location_updated', {
        userId: uId,
        lat,
        lng,
      });
    }
  });

  // Start real-time buddy coordination
  socket.on('buddy_walk_start', (data) => {
    const { buddyId, walkSessionId } = data;
    const buddySocketId = userSocketMap.get(buddyId);
    if (buddySocketId) {
      io.to(buddySocketId).emit('buddy_walk_started', {
        buddyId: socketUserMap.get(socket.id),
        walkSessionId,
      });
    }
  });

  // Coordinates streaming between walking buddies
  socket.on('buddy_coordinates', (data) => {
    const { buddyId, lat, lng, speed, timestamp } = data;
    const buddySocketId = userSocketMap.get(buddyId);
    if (buddySocketId) {
      io.to(buddySocketId).emit('buddy_location_stream', {
        lat,
        lng,
        speed,
        timestamp,
      });
    }
  });

  // Clean disconnect
  socket.on('disconnect', async () => {
    const uId = socketUserMap.get(socket.id);
    if (uId) {
      socketUserMap.delete(socket.id);
      userSocketMap.delete(uId);

      // Debounce offline trigger in case of page reload or temporary drop
      setTimeout(async () => {
        if (!userSocketMap.has(uId)) {
          await User.findByIdAndUpdate(uId, { isOnline: false, lastSeen: new Date() });
          io.emit('user_offline', { userId: uId });
          console.log(`User offline: ${uId}`);
        }
      }, 5000);
    }
  });
});

// Attach socket io instance to app for use in controllers if needed
app.set('io', io);
app.set('userSocketMap', userSocketMap);

server.listen(PORT, () => {
  console.log(`WalkStreak server running on port ${PORT}`);
});

module.exports = { app, server };
