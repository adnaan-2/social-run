const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register a new user
// @route   POST /api/auth/signup
exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          existingUser.email === email
            ? 'Email already registered'
            : 'Username already taken',
      });
    }

    // Create user
    const user = await User.create({ username, email, password });

    // Generate token
    const token = user.getSignedJwtToken(false);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
    });

    return res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalDistance: user.totalDistance,
        totalWalks: user.totalWalks,
        xp: user.xp,
        level: user.level,
        badges: user.badges,
        bio: user.bio,
        fitnessLevel: user.fitnessLevel,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during signup',
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Find user with password field included
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate token
    const token = user.getSignedJwtToken(rememberMe);

    // Cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };

    // If rememberMe, set maxAge to 30 days; otherwise session cookie
    if (rememberMe) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    // Set cookie
    res.cookie('token', token, cookieOptions);

    // Update user online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalDistance: user.totalDistance,
        totalWalks: user.totalWalks,
        xp: user.xp,
        level: user.level,
        badges: user.badges,
        bio: user.bio,
        fitnessLevel: user.fitnessLevel,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    // Clear the token cookie
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/',
    });

    // Update user status if authenticated
    if (req.user) {
      req.user.isOnline = false;
      req.user.lastSeen = new Date();
      await req.user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during logout',
    });
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error('GetMe error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, bio, fitnessLevel, profilePhoto } = req.body;

    // Build update object with only provided fields
    const update = {};
    if (username !== undefined) update.username = username;
    if (bio !== undefined) update.bio = bio;
    if (fitnessLevel !== undefined) update.fitnessLevel = fitnessLevel;
    if (profilePhoto !== undefined) update.profilePhoto = profilePhoto;

    // If username is being changed, check if it's taken
    if (username) {
      const existingUser = await User.findOne({
        username,
        _id: { $ne: req.user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during profile update',
    });
  }
};

// @desc    Authenticate with Google
// @route   POST /api/auth/google
exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: 'Google credential is required',
      });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Check if user exists by googleId
    let user = await User.findOne({ googleId });

    if (!user) {
      // Check if user exists by email
      user = await User.findOne({ email });

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        user.authProvider = 'google';
        if (picture && !user.profilePhoto) {
          user.profilePhoto = picture;
        }
        await user.save();
      } else {
        // Create a new user
        const baseUsername = name
          ? name.replace(/\s+/g, '').toLowerCase()
          : 'user';
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const username = `${baseUsername}${randomSuffix}`;

        user = await User.create({
          username,
          email,
          googleId,
          authProvider: 'google',
          profilePhoto: picture || '',
        });
      }
    }

    // Generate token
    const token = user.getSignedJwtToken(true);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
    });

    // Update user online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        totalDistance: user.totalDistance,
        totalWalks: user.totalWalks,
        xp: user.xp,
        level: user.level,
        badges: user.badges,
        bio: user.bio,
        fitnessLevel: user.fitnessLevel,
      },
    });
  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during Google authentication',
    });
  }
};
