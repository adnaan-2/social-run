const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const {
  validateSignup,
  validateLogin,
  handleValidationErrors,
} = require('../middleware/validate');
const {
  signup,
  login,
  logout,
  getMe,
  updateProfile,
  googleAuth,
} = require('../controllers/authController');

// Optional auth middleware - tries to attach user but doesn't block if no token
const optionalProtect = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Token invalid, just continue without user
  }
  next();
};

// Public routes
router.post('/signup', validateSignup, handleValidationErrors, signup);
router.post('/login', validateLogin, handleValidationErrors, login);
router.post('/google', googleAuth);

// Logout with optional auth (try to get user for cleanup)
router.post('/logout', optionalProtect, logout);

// Protected routes
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
