const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queries } = require('./db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'changethisinsecret';

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    if (queries.findUserByEmail.get(email))
      return res.status(409).json({ error: 'Email already in use' });

    if (queries.findUserByUsername.get(username))
      return res.status(409).json({ error: 'Username already taken' });

    const password_hash = await bcrypt.hash(password, 12);
    const result = queries.createUser.run(username, email, password_hash);

    const token = jwt.sign(
      { userId: result.lastInsertRowid, username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, username, email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const user = queries.findUserByEmail.get(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// Update username
router.put('/update-username', authenticateToken, (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length < 2)
      return res.status(400).json({ error: 'Username must be at least 2 characters' });

    const existing = queries.findUserByUsername.get(username.trim());
    if (existing && existing.id !== req.user.userId)
      return res.status(409).json({ error: 'Username already taken' });

    queries.updateUsername.run(username.trim(), req.user.userId);
    const updatedUser = queries.findUserById.get(req.user.userId);
    res.json({ user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update password
router.put('/update-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both fields are required' });

    if (newPassword.length < 6)
      return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = queries.findUserById.get(req.user.userId);
    const fullUser = queries.findUserByEmail.get(user.email);
    const valid = await bcrypt.compare(currentPassword, fullUser.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    queries.updatePassword.run(hash, req.user.userId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete account
router.delete('/delete-account', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    const user = queries.findUserById.get(req.user.userId);
    const fullUser = queries.findUserByEmail.get(user.email);
    const valid = await bcrypt.compare(password, fullUser.password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    const id = req.user.userId;
    queries.deleteUserMessages.run(id, id);
    queries.deleteUserContacts.run(id, id);
    queries.deleteUserRequests.run(id, id);
    queries.deleteUser.run(id);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// Get preferences
router.get('/preferences', authenticateToken, (req, res) => {
  try {
    const prefs = queries.getPreferences.get(req.user.userId);
    res.json(prefs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update preferences
router.put('/preferences', authenticateToken, (req, res) => {
  try {
    const { avatar_color, dark_mode, sound_on } = req.body;
    queries.updatePreferences.run(
      avatar_color ?? 0,
      dark_mode ? 1 : 0,
      sound_on ? 1 : 0,
      req.user.userId
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, authenticateToken, JWT_SECRET };