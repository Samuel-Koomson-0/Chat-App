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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
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
  `)
};

module.exports = { db, queries };