const User = require('../models/User');
const Follow = require('../models/Follow');
const JoinWalkRequest = require('../models/JoinWalkRequest');

// @desc    Get nearby online walkers
// @route   GET /api/social/nearby
exports.getNearbyWalkers = async (req, res) => {
  try {
    let coords = req.user.currentLocation?.coordinates || [0, 0];

    // If client provided query params, update the current user's location
    if (req.query.lng && req.query.lat) {
      coords = [parseFloat(req.query.lng), parseFloat(req.query.lat)];
      await User.findByIdAndUpdate(req.user._id, {
        currentLocation: { type: 'Point', coordinates: coords },
        isOnline: true,
        lastSeen: new Date(),
      });
    }

    // Default distance 10km (10000m)
    const maxDistance = parseFloat(req.query.distance) || 10000;

    // If user coordinates are default [0, 0], we might just return all other online users
    let query = {
      isOnline: true,
      _id: { $ne: req.user._id },
    };

    if (coords[0] !== 0 || coords[1] !== 0) {
      query.currentLocation = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coords,
          },
          $maxDistance: maxDistance,
        },
      };
    }

    const nearbyUsers = await User.find(query)
      .select('username profilePhoto fitnessLevel currentStreak level isOnline currentLocation')
      .limit(30);

    // Get following list to check if we are already following each user
    const following = await Follow.find({ followerId: req.user._id }).select('followingId');
    const followingIds = following.map((f) => f.followingId.toString());

    const nearbyWithFollowStatus = nearbyUsers.map((u) => {
      const userObj = u.toObject();
      userObj.isFollowing = followingIds.includes(u._id.toString());
      return userObj;
    });

    return res.status(200).json({
      success: true,
      walkers: nearbyWithFollowStatus,
    });
  } catch (error) {
    console.error('Get nearby walkers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving nearby walkers',
    });
  }
};

// @desc    Follow a user
// @route   POST /api/social/follow/:userId
exports.followUser = async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    if (targetUserId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself',
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId: req.user._id,
      followingId: targetUserId,
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user',
      });
    }

    await Follow.create({
      followerId: req.user._id,
      followingId: targetUserId,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully followed ${targetUser.username}`,
    });
  } catch (error) {
    console.error('Follow error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during follow operation',
    });
  }
};

// @desc    Unfollow a user
// @route   POST /api/social/unfollow/:userId
exports.unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const follow = await Follow.findOneAndDelete({
      followerId: req.user._id,
      followingId: targetUserId,
    });

    if (!follow) {
      return res.status(400).json({
        success: false,
        message: 'You are not following this user',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully unfollowed user',
    });
  } catch (error) {
    console.error('Unfollow error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during unfollow operation',
    });
  }
};

// @desc    Get followers
// @route   GET /api/social/followers
exports.getFollowers = async (req, res) => {
  try {
    const followers = await Follow.find({ followingId: req.user._id })
      .populate('followerId', 'username profilePhoto level fitnessLevel currentStreak')
      .sort({ createdAt: -1 });

    const following = await Follow.find({ followerId: req.user._id }).select('followingId');
    const followingIds = following.map((f) => f.followingId.toString());

    const list = followers
      .filter((f) => f.followerId)
      .map((f) => {
        const u = f.followerId.toObject();
        u.isFollowing = followingIds.includes(u._id.toString());
        u.followCreatedAt = f.createdAt;
        return u;
      });

    return res.status(200).json({
      success: true,
      followers: list,
    });
  } catch (error) {
    console.error('Get followers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving followers',
    });
  }
};

// @desc    Get following list
// @route   GET /api/social/following
exports.getFollowing = async (req, res) => {
  try {
    const following = await Follow.find({ followerId: req.user._id })
      .populate('followingId', 'username profilePhoto level fitnessLevel currentStreak isOnline')
      .sort({ createdAt: -1 });

    const list = following
      .filter((f) => f.followingId)
      .map((f) => {
        const u = f.followingId.toObject();
        u.isFollowing = true;
        u.followCreatedAt = f.createdAt;
        return u;
      });

    return res.status(200).json({
      success: true,
      following: list,
    });
  } catch (error) {
    console.error('Get following error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving following list',
    });
  }
};

// @desc    Send request to join a walk
// @route   POST /api/social/requests
exports.sendJoinWalkRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;

    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a walk request to yourself',
      });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Recipient user not found',
      });
    }

    // Check if there is already a pending request between these two
    const existingRequest = await JoinWalkRequest.findOne({
      senderId: req.user._id,
      receiverId: receiverId,
      status: 'pending',
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Walk request already sent and pending',
      });
    }

    const newRequest = await JoinWalkRequest.create({
      senderId: req.user._id,
      receiverId: receiverId,
    });

    // Populate sender details for notifications
    const requestDetails = await JoinWalkRequest.findById(newRequest._id)
      .populate('senderId', 'username profilePhoto level')
      .populate('receiverId', 'username profilePhoto level');

    return res.status(201).json({
      success: true,
      request: requestDetails,
    });
  } catch (error) {
    console.error('Send walk request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error sending walk request',
    });
  }
};

// @desc    Get active/pending join walk requests (both incoming and outgoing)
// @route   GET /api/social/requests
exports.getJoinRequests = async (req, res) => {
  try {
    const incoming = await JoinWalkRequest.find({
      receiverId: req.user._id,
      status: 'pending',
    })
      .populate('senderId', 'username profilePhoto level fitnessLevel currentStreak')
      .sort({ createdAt: -1 });

    const outgoing = await JoinWalkRequest.find({
      senderId: req.user._id,
      status: 'pending',
    })
      .populate('receiverId', 'username profilePhoto level fitnessLevel currentStreak')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      incoming,
      outgoing,
    });
  } catch (error) {
    console.error('Get walk requests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving walk requests',
    });
  }
};

// @desc    Respond to join walk request (Accept/Decline)
// @route   POST /api/social/requests/:requestId/respond
exports.respondToJoinRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'accepted' or 'declined'

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid response status. Must be accepted or declined',
      });
    }

    const request = await JoinWalkRequest.findOne({
      _id: requestId,
      receiverId: req.user._id,
      status: 'pending',
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Pending request not found',
      });
    }

    request.status = status;
    await request.save();

    const populatedRequest = await JoinWalkRequest.findById(request._id)
      .populate('senderId', 'username profilePhoto isOnline')
      .populate('receiverId', 'username profilePhoto isOnline');

    return res.status(200).json({
      success: true,
      request: populatedRequest,
    });
  } catch (error) {
    console.error('Respond to request error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error responding to request',
    });
  }
};
