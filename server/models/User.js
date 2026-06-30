const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  profilePhoto: {
    type: String,
    default: '',
  },
  bio: {
    type: String,
    maxlength: [200, 'Bio cannot exceed 200 characters'],
    default: '',
  },
  fitnessLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    default: 'beginner',
  },
  currentStreak: {
    type: Number,
    default: 0,
  },
  longestStreak: {
    type: Number,
    default: 0,
  },
  streakFreezeAvailable: {
    type: Number,
    default: 1,
  },
  lastWalkDate: {
    type: Date,
  },
  totalDistance: {
    type: Number,
    default: 0, // meters
  },
  totalWalks: {
    type: Number,
    default: 0,
  },
  maxSingleWalk: {
    type: Number,
    default: 0, // meters
  },
  xp: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 1,
  },
  badges: [
    {
      name: String,
      earnedAt: Date,
      icon: String,
    },
  ],
  isOnline: {
    type: Boolean,
    default: false,
  },
  lastSeen: {
    type: Date,
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 2dsphere index for geospatial queries
UserSchema.index({ currentLocation: '2dsphere' });

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.password || !this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});


// Compare entered password with hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate signed JWT token
UserSchema.methods.getSignedJwtToken = function (rememberMe) {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? '30d' : '1d',
  });
};

module.exports = mongoose.model('User', UserSchema);
