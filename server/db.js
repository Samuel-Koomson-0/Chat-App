const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'chat.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_color INTEGER DEFAULT 0,
    dark_mode INTEGER DEFAULT 0,
    sound_on INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    UNIQUE(sender_id, receiver_id)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id),
    FOREIGN KEY (user2_id) REFERENCES users(id),
    UNIQUE(user1_id, user2_id)
  );
`);

const queries = {
  createUser: db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'),
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  findUserById: db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?'),
  getAllUsers: db.prepare('SELECT id, username, email FROM users WHERE id != ?'),
  saveMessage: db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)'),
  getConversation: db.prepare(`
    SELECT m.*, u1.username as sender_username, u2.username as receiver_username
    FROM messages m
    JOIN users u1 ON m.sender_id = u1.id
    JOIN users u2 ON m.receiver_id = u2.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?)
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
    LIMIT 100
  `),
  markMessagesAsRead: db.prepare(`
  UPDATE messages SET is_read = 1
  WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
`),
getUnreadMessages: db.prepare(`
  SELECT id FROM messages
  WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
`),
searchUsers: db.prepare(`
  SELECT id, username, email FROM users
  WHERE username LIKE ? AND id != ?
  LIMIT 10
`),
sendRequest: db.prepare(`
  INSERT OR IGNORE INTO requests (sender_id, receiver_id) VALUES (?, ?)
`),
acceptRequest: db.prepare(`
  UPDATE requests SET status = 'accepted'
  WHERE sender_id = ? AND receiver_id = ?
`),
declineRequest: db.prepare(`
  UPDATE requests SET status = 'declined'
  WHERE sender_id = ? AND receiver_id = ?
`),
getPendingRequests: db.prepare(`
  SELECT r.*, u.username as sender_username, u.email as sender_email
  FROM requests r
  JOIN users u ON r.sender_id = u.id
  WHERE r.receiver_id = ? AND r.status = 'pending'
`),
addContact: db.prepare(`
  INSERT OR IGNORE INTO contacts (user1_id, user2_id) VALUES (?, ?)
`),
getContacts: db.prepare(`
  SELECT u.id, u.username, u.email, u.avatar_color FROM contacts c
  JOIN users u ON (
    CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END = u.id
  )
  WHERE c.user1_id = ? OR c.user2_id = ?
`),
getRequestStatus: db.prepare(`
  SELECT status FROM requests
  WHERE (sender_id = ? AND receiver_id = ?)
  OR (sender_id = ? AND receiver_id = ?)
  LIMIT 1
`),
updateUsername: db.prepare('UPDATE users SET username = ? WHERE id = ?'),
updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
deleteUserMessages: db.prepare('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?'),
deleteUserContacts: db.prepare('DELETE FROM contacts WHERE user1_id = ? OR user2_id = ?'),
deleteUserRequests: db.prepare('DELETE FROM requests WHERE sender_id = ? OR receiver_id = ?'),
updatePreferences: db.prepare(`
  UPDATE users SET avatar_color = ?, dark_mode = ?, sound_on = ? WHERE id = ?
`),
getPreferences: db.prepare(`
  SELECT avatar_color, dark_mode, sound_on FROM users WHERE id = ?
`),
};

module.exports = { db, queries };