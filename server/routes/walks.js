const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  startWalk,
  trackWalk,
  endWalk,
  getWalkHistory,
} = require('../controllers/walkController');

// All routes are protected
router.use(protect);

router.post('/start', startWalk);
router.post('/track/:id', trackWalk);
router.post('/end/:id', endWalk);
router.get('/history', getWalkHistory);

module.exports = router;
