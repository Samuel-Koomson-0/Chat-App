const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { queries } = require('./db');
const { router: authRouter, authenticateToken, JWT_SECRET } = require('./auth');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);

app.get('/api/users', authenticateToken, (req, res) => {
  const users = queries.getAllUsers.all(req.user.userId);
  res.json(users);
});

app.get('/api/messages/:userId', authenticateToken, (req, res) => {
  const { userId } = req.params;
  const myId = req.user.userId;
  const messages = queries.getConversation.all(myId, userId, userId, myId);
  res.json(messages);
});

const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Invalid token'));
    socket.user = user;
    next();
  });
});

io.on('connection', (socket) => {
  const { userId, username } = socket.user;
  console.log(`${username} connected`);

  onlineUsers.set(userId, socket.id);
io.emit('online_users', Array.from(onlineUsers.keys()));

// Send current online users directly to the newly connected socket
socket.emit('online_users', Array.from(onlineUsers.keys()));


  socket.on('typing', ({ to, isTyping }) => {
  const recipientSocket = onlineUsers.get(to);
  if (recipientSocket) {
    io.to(recipientSocket).emit('typing', { from: userId, isTyping });
  }
});


socket.on('mark_read', ({ from }) => {
  // Mark all messages from 'from' to current user as read
  const unread = queries.getUnreadMessages.all(from, userId);
  queries.markMessagesAsRead.run(from, userId);

  // Notify the sender that their messages were read
  const senderSocket = onlineUsers.get(from);
  if (senderSocket && unread.length > 0) {
    io.to(senderSocket).emit('messages_read', {
      by: userId,
      messageIds: unread.map(m => m.id)
    });
  }
});


  socket.on('private_message', ({ to, content }) => {
    if (!content?.trim()) return;

    const result = queries.saveMessage.run(userId, to, content.trim());
    const message = {
      id: result.lastInsertRowid,
      sender_id: userId,
      receiver_id: to,
      sender_username: username,
      content: content.trim(),
      created_at: new Date().toISOString()
    };

    const recipientSocket = onlineUsers.get(to);
    if (recipientSocket) {
      io.to(recipientSocket).emit('private_message', message);
    }

    socket.emit('private_message', message);
  });

  socket.on('disconnect', () => {
    console.log(`${username} disconnected`);
    onlineUsers.delete(userId);
    io.emit('online_users', Array.from(onlineUsers.keys()));
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});