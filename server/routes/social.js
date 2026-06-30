const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getNearbyWalkers,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  sendJoinWalkRequest,
  getJoinRequests,
  respondToJoinRequest,
} = require('../controllers/socialController');

// All routes are protected
router.use(protect);

router.get('/nearby', getNearbyWalkers);
router.post('/follow/:userId', followUser);
router.post('/unfollow/:userId', unfollowUser);
router.get('/followers', getFollowers);
router.get('/following', getFollowing);
router.post('/requests', sendJoinWalkRequest);
router.get('/requests', getJoinRequests);
router.post('/requests/:requestId/respond', respondToJoinRequest);

module.exports = router;
