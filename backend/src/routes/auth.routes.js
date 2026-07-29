const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// In-memory user database (replace with real database in production)
// Default password for all users: "opti2024"
const users = [
  {
    id: 1,
    username: 'admin',
    password: '$2b$10$ydP7HPWBQ0EPjlDicF3ZjOXQCAQBmihZtNNuL9tvrf2O2hF4VbXYy', // opti2024
    role: 'admin',
    name: 'Admin User'
  },
  {
    id: 2,
    username: 'operator',
    password: '$2b$10$ydP7HPWBQ0EPjlDicF3ZjOXQCAQBmihZtNNuL9tvrf2O2hF4VbXYy', // opti2024
    role: 'operator',
    name: 'Operator User'
  },
  {
    id: 3,
    username: 'viewer',
    password: '$2b$10$ydP7HPWBQ0EPjlDicF3ZjOXQCAQBmihZtNNuL9tvrf2O2hF4VbXYy', // opti2024
    role: 'viewer',
    name: 'Viewer User'
  }
];

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.'
      });
    }

    // Find user
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    // Generate JWT token (expires in 8 hours)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Get current user info
router.get('/me', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      name: req.user.name
    }
  });
});

// Logout (client-side will delete token)
router.post('/logout', verifyToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

module.exports = router;
