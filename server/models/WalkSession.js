const mongoose = require('mongoose');

const WalkSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  distance: {
    type: Number,
    default: 0, // meters
  },
  duration: {
    type: Number,
    default: 0, // seconds
  },
  averagePace: {
    type: Number,
    default: 0, // min/km
  },
  coordinates: [
    {
      lat: Number,
      lng: Number,
      timestamp: Date,
      speed: Number,
    },
  ],
  isBuddyWalk: {
    type: Boolean,
    default: false,
  },
  buddyUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  wasOfflineSynced: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('WalkSession', WalkSessionSchema);
