const WalkSession = require('../models/WalkSession');
const User = require('../models/User');

// @desc    Start a new walk session
// @route   POST /api/walks/start
exports.startWalk = async (req, res) => {
  try {
    const { startTime, isBuddyWalk, buddyUserId } = req.body;

    const newSession = await WalkSession.create({
      userId: req.user._id,
      startTime: startTime || new Date(),
      isBuddyWalk: isBuddyWalk || false,
      buddyUserId: isBuddyWalk ? buddyUserId : undefined,
      coordinates: [],
    });

    return res.status(201).json({
      success: true,
      walkSession: newSession,
    });
  } catch (error) {
    console.error('Start walk error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during walk start',
    });
  }
};

// @desc    Track coordinates during a walk session
// @route   POST /api/walks/track/:id
exports.trackWalk = async (req, res) => {
  try {
    const { coordinates } = req.body; // Array of { lat, lng, timestamp, speed }
    const { id } = req.params;

    const walkSession = await WalkSession.findOne({ _id: id, userId: req.user._id });

    if (!walkSession) {
      return res.status(404).json({
        success: false,
        message: 'Walk session not found',
      });
    }

    if (walkSession.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Cannot track coordinates for an ended walk session',
      });
    }

    if (coordinates && Array.isArray(coordinates)) {
      walkSession.coordinates.push(...coordinates);
      await walkSession.save();
    }

    return res.status(200).json({
      success: true,
      coordinatesCount: walkSession.coordinates.length,
    });
  } catch (error) {
    console.error('Track walk error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during walk tracking',
    });
  }
};

// Helper function to calculate distance between two coordinates in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// @desc    End a walk session and update user achievements
// @route   POST /api/walks/end/:id
exports.endWalk = async (req, res) => {
  try {
    const { endTime, distance: clientDistance, duration: clientDuration, coordinates } = req.body;
    const { id } = req.params;

    const walkSession = await WalkSession.findOne({ _id: id, userId: req.user._id });

    if (!walkSession) {
      return res.status(404).json({
        success: false,
        message: 'Walk session not found',
      });
    }

    if (walkSession.endTime) {
      return res.status(400).json({
        success: false,
        message: 'Walk session is already ended',
      });
    }

    // Save final coordinates if any
    if (coordinates && Array.isArray(coordinates) && coordinates.length > 0) {
      walkSession.coordinates.push(...coordinates);
    }

    walkSession.endTime = endTime || new Date();

    // Calculate duration in seconds
    const start = new Date(walkSession.startTime);
    const end = new Date(walkSession.endTime);
    const calculatedDuration = Math.max(1, Math.round((end - start) / 1000));
    walkSession.duration = clientDuration || calculatedDuration;

    // Calculate distance in meters from coordinates if not provided
    let calculatedDistance = 0;
    if (walkSession.coordinates.length > 1) {
      for (let i = 0; i < walkSession.coordinates.length - 1; i++) {
        const p1 = walkSession.coordinates[i];
        const p2 = walkSession.coordinates[i + 1];
        calculatedDistance += getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      }
    }
    walkSession.distance = clientDistance || Math.round(calculatedDistance);

    // Calculate average pace in min/km
    const distanceKm = walkSession.distance / 1000;
    if (distanceKm > 0) {
      // (duration in seconds / 60) / distance in km
      walkSession.averagePace = (walkSession.duration / 60) / distanceKm;
    } else {
      walkSession.averagePace = 0;
    }

    await walkSession.save();

    // Update user stats
    const user = await User.findById(req.user._id);

    // 1. Add walks & distance
    user.totalWalks += 1;
    user.totalDistance += walkSession.distance;
    user.maxSingleWalk = Math.max(user.maxSingleWalk || 0, walkSession.distance);

    // 2. Streak update logic
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (user.lastWalkDate) {
      const lastWalk = new Date(user.lastWalkDate);
      lastWalk.setHours(0, 0, 0, 0);

      if (lastWalk.getTime() === yesterday.getTime()) {
        // Walked yesterday, increment streak
        user.currentStreak += 1;
      } else if (lastWalk.getTime() === today.getTime()) {
        // Already walked today, streak remains same
      } else {
        // Missed yesterday, check streak freeze
        if (user.streakFreezeAvailable > 0) {
          user.streakFreezeAvailable -= 1;
          user.currentStreak += 1; // Saved by freeze + incremented for today
        } else {
          user.currentStreak = 1; // Reset to 1
        }
      }
    } else {
      // First walk ever
      user.currentStreak = 1;
    }

    user.longestStreak = Math.max(user.longestStreak || 0, user.currentStreak);
    user.lastWalkDate = walkSession.endTime;

    // 3. XP & Level calculations
    // Base XP: 100 XP for walk completion + 1 XP per 10 meters walked
    let earnedXp = 100 + Math.floor(walkSession.distance / 10);
    if (walkSession.isBuddyWalk) {
      earnedXp += 50; // Buddy bonus
    }
    user.xp += earnedXp;

    // Level up calculation: 1000 XP per level
    const previousLevel = user.level || 1;
    user.level = Math.floor(user.xp / 1000) + 1;
    const isLevelUp = user.level > previousLevel;

    // 4. Badges / Achievements check
    const currentBadges = user.badges.map((b) => b.name);
    const newBadges = [];

    const badgeCheck = (name, condition, icon) => {
      if (condition && !currentBadges.includes(name)) {
        newBadges.push({ name, icon, earnedAt: new Date() });
      }
    };

    badgeCheck('First Steps', user.totalWalks >= 1, '👟');
    badgeCheck('Streak Starter', user.currentStreak >= 3, '🔥');
    badgeCheck('Streak Master', user.currentStreak >= 7, '👑');
    badgeCheck('10K Club', walkSession.distance >= 10000, '⚡');
    badgeCheck('Marathoner', user.totalDistance >= 42195, '🏆');
    badgeCheck('Social Walker', walkSession.isBuddyWalk || user.totalWalks >= 5, '👥');
    badgeCheck('Level 5 Walker', user.level >= 5, '⭐');

    if (newBadges.length > 0) {
      user.badges.push(...newBadges);
    }

    await user.save();

    return res.status(200).json({
      success: true,
      walkSession,
      user,
      earnedXp,
      isLevelUp,
      newBadges,
    });
  } catch (error) {
    console.error('End walk error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during walk completion',
    });
  }
};

// @desc    Get walk history for the current user
// @route   GET /api/walks/history
exports.getWalkHistory = async (req, res) => {
  try {
    const walks = await WalkSession.find({ userId: req.user._id })
      .sort({ startTime: -1 })
      .populate('buddyUserId', 'username profilePhoto');

    return res.status(200).json({
      success: true,
      walks,
    });
  } catch (error) {
    console.error('Get walk history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving walk history',
    });
  }
};
