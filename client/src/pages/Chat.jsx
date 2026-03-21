import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSocket, disconnectSocket } from '../socket';

export default function Chat() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = Number(currentUser.id);
  const token = localStorage.getItem('token');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    axios.get('http://localhost:3001/api/users', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => setUsers(r.data)).catch(console.error);
  }, [token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (msg) => {
      const selected = selectedUserRef.current;
      const senderId = Number(msg.sender_id);

      if (senderId === currentUserId) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        return;
      }

      if (selected && senderId === Number(selected.id)) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTypingUsers(prev => ({ ...prev, [senderId]: false }));

        // Mark as read immediately since conversation is open
        socket.emit('mark_read', { from: senderId });
      } else {
        setUnreadCounts(prev => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1
        }));
      }
    };

    const handleOnlineUsers = (ids) => setOnlineUsers(ids.map(Number));

    const handleTyping = ({ from, isTyping }) => {
      setTypingUsers(prev => ({ ...prev, [from]: isTyping }));
    };

    const handleMessagesRead = ({  messageIds }) => {
      setMessages(prev =>
        prev.map(m =>
          messageIds.includes(m.id) ? { ...m, is_read: 1 } : m
        )
      );
    };

    socket.on('private_message', handleMessage);
    socket.on('online_users', handleOnlineUsers);
    socket.on('typing', handleTyping);
    socket.on('messages_read', handleMessagesRead);

    return () => {
      socket.off('private_message', handleMessage);
      socket.off('online_users', handleOnlineUsers);
      socket.off('typing', handleTyping);
      socket.off('messages_read', handleMessagesRead);
    };
  }, [currentUserId]);

  const selectUser = useCallback(async (user) => {
    setSelectedUser(user);
    selectedUserRef.current = user;
    setMessages([]);
    setUnreadCounts(prev => ({ ...prev, [user.id]: 0 }));

    const socket = getSocket();
    if (socket) socket.emit('mark_read', { from: Number(user.id) });

    try {
      const { data } = await axios.get(
        `http://localhost:3001/api/messages/${user.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const goBack = () => {
    setSelectedUser(null);
    selectedUserRef.current = null;
    setMessages([]);
  };

  const sendMessage = () => {
    const socket = getSocket();
    if (!socket || !input.trim() || !selectedUser) return;
    socket.emit('private_message', { to: Number(selectedUser.id), content: input.trim() });
    socket.emit('typing', { to: Number(selectedUser.id), isTyping: false });
    setInput('');
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const socket = getSocket();
    if (!socket || !selectedUser) return;
    socket.emit('typing', { to: Number(selectedUser.id), isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { to: Number(selectedUser.id), isTyping: false });
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const logout = () => {
    disconnectSocket();
    localStorage.clear();
    navigate('/login');
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  });

  const isOnline = (userId) => onlineUsers.includes(Number(userId));
  const isTyping = (userId) => typingUsers[Number(userId)] === true;

  const renderTicks = (msg) => {
    const mine = Number(msg.sender_id) === currentUserId;
    if (!mine) return null;
    if (msg.is_read) {
      return <span style={s.ticksRead}>✓✓</span>;
    }
    return <span style={s.ticksSent}>✓</span>;
  };

  return (
    <div style={s.layout}>
      <aside style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={s.meRow}>
            <div style={s.avatar}>{currentUser.username?.[0]?.toUpperCase()}</div>
            <div>
              <div style={s.myName}>{currentUser.username}</div>
              <div style={s.onlineDot}>● Online</div>
            </div>
            <button onClick={logout} style={s.logoutBtn} title="Logout">⎋</button>
          </div>
          <input
            style={s.search}
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={s.userList}>
          {filteredUsers.length === 0 && (
            <div style={s.emptyUsers}>No users found</div>
          )}
          {filteredUsers.map(user => {
            const unread = unreadCounts[user.id] || 0;
            return (
              <div
                key={user.id}
                style={{
                  ...s.userItem,
                  background: selectedUser?.id === user.id ? '#252530' : 'transparent',
                }}
                onClick={() => selectUser(user)}
              >
                <div style={{ position: 'relative' }}>
                  <div style={s.avatarSm}>{user.username[0].toUpperCase()}</div>
                  {isOnline(user.id) && <div style={s.greenDot} />}
                </div>
                <div style={{ ...s.userInfo, flex: 1 }}>
                  <span style={s.userName}>{user.username}</span>
                  {isTyping(user.id) ? (
                    <span style={{ ...s.status, color: '#818cf8' }}>✎ typing...</span>
                  ) : unread > 0 ? (
                    <span style={s.unreadText}>
                      {unread > 9 ? '9+ new messages' : unread === 1 ? '1 new message' : `${unread} new messages`}
                    </span>
                  ) : null}
                </div>
                {unread > 0 && <div style={s.unreadDot} />}
              </div>
            );
          })}
        </div>
      </aside>

      <main style={s.main}>
        {!selectedUser ? (
          <div style={s.empty}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <div style={s.emptyTitle}>Select a conversation</div>
            <div style={s.emptySub}>Choose someone from the sidebar to start chatting</div>
          </div>
        ) : (
          <>
            <div style={s.chatHeader}>
              <button onClick={goBack} style={s.backBtn} title="Back">←</button>
              <div style={{ position: 'relative' }}>
                <div style={s.avatarSm}>{selectedUser.username[0].toUpperCase()}</div>
                {isOnline(selectedUser.id) && <div style={s.greenDot} />}
              </div>
              <div>
                <div style={s.chatName}>{selectedUser.username}</div>
                {(isTyping(selectedUser.id) || isOnline(selectedUser.id)) && (
                  <div style={{ fontSize: 12, color: isTyping(selectedUser.id) ? '#818cf8' : '#4ade80' }}>
                    {isTyping(selectedUser.id) ? '✎ typing...' : 'Online'}
                  </div>
                )}
              </div>
            </div>

            <div style={s.messages}>
              {messages.length === 0 && (
                <div style={s.noMsgs}>No messages yet — say hello! 👋</div>
              )}
              {messages.map((msg) => {
                const mine = Number(msg.sender_id) === currentUserId;
                return (
                  <div key={msg.id} style={{ ...s.msgRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    {!mine && <div style={s.avatarXs}>{selectedUser.username[0].toUpperCase()}</div>}
                    <div style={{ maxWidth: '70%' }}>
                      <div style={{
                        ...s.bubble,
                        background: mine ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#1e1e28',
                        borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      }}>
                        {msg.content}
                      </div>
                      <div style={{ ...s.time, textAlign: mine ? 'right' : 'left', display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'center', gap: 4 }}>
                        {formatTime(msg.created_at)}
                        {renderTicks(msg)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div style={s.inputBar}>
              <input
                style={s.msgInput}
                placeholder={`Message ${selectedUser.username}...`}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              <button
                style={{ ...s.sendBtn, opacity: input.trim() ? 1 : 0.4 }}
                onClick={sendMessage}
                disabled={!input.trim()}
              >
                ➤
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const s = {
  layout: { display: 'flex', height: '100vh', background: '#0f0f10' },
  sidebar: {
    width: 280, background: '#13131a', borderRight: '1px solid #1e1e2e',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  },
  sidebarHeader: { padding: '20px 16px 12px', borderBottom: '1px solid #1e1e2e' },
  meRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatar: {
    width: 38, height: 38, borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 15, color: '#fff', flexShrink: 0,
  },
  avatarSm: {
    width: 34, height: 34, borderRadius: '50%', background: '#2a2a40',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: 14, color: '#a0a0c0', flexShrink: 0,
  },
  avatarXs: {
    width: 28, height: 28, borderRadius: '50%', background: '#2a2a40',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: 12, color: '#a0a0c0', flexShrink: 0,
    alignSelf: 'flex-end', marginRight: 6,
  },
  myName: { fontSize: 14, fontWeight: 600, color: '#e8e8e8' },
  onlineDot: { fontSize: 11, color: '#4ade80' },
  greenDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 11, height: 11, borderRadius: '50%',
    background: '#4ade80', border: '2px solid #13131a',
  },
  unreadText: {
    fontSize: 12, fontWeight: 600, color: '#818cf8', marginTop: 2,
  },
  unreadDot: {
    width: 10, height: 10, borderRadius: '50%',
    background: '#6366f1', flexShrink: 0, alignSelf: 'center',
  },
  logoutBtn: {
    marginLeft: 'auto', background: 'none', color: '#555',
    fontSize: 18, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
  },
  backBtn: {
    background: 'none', color: '#a0a0c0', fontSize: 22,
    padding: '4px 10px', borderRadius: 8, cursor: 'pointer', marginRight: 4,
  },
  search: {
    width: '100%', background: '#0f0f10', border: '1px solid #1e1e2e',
    borderRadius: 8, padding: '8px 12px', color: '#e8e8e8', fontSize: 13,
  },
  userList: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  userItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s',
  },
  userInfo: { display: 'flex', flexDirection: 'column' },
  userName: { fontSize: 14, fontWeight: 500, color: '#e0e0e0' },
  status: { fontSize: 11, marginTop: 2 },
  emptyUsers: { padding: '20px 16px', color: '#555', fontSize: 13 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', color: '#444',
  },
  emptyTitle: { fontSize: 20, fontWeight: 600, color: '#555', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#3a3a4a' },
  chatHeader: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 20px', borderBottom: '1px solid #1e1e2e', background: '#13131a',
  },
  chatName: { fontSize: 15, fontWeight: 600, color: '#e8e8e8' },
  messages: {
    flex: 1, overflowY: 'auto', padding: '20px 20px 8px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  noMsgs: { textAlign: 'center', color: '#3a3a4a', fontSize: 14, margin: 'auto' },
  msgRow: { display: 'flex', alignItems: 'flex-end' },
  bubble: { padding: '10px 14px', fontSize: 14, lineHeight: 1.5, color: '#f0f0f0', wordBreak: 'break-word' },
  time: { fontSize: 11, color: '#3a3a50', marginTop: 3, paddingInline: 2 },
  ticksSent: { fontSize: 11, color: '#555' },
  ticksRead: { fontSize: 11, color: '#6366f1' },
  inputBar: {
    padding: '12px 16px', borderTop: '1px solid #1e1e2e',
    display: 'flex', gap: 10, alignItems: 'center', background: '#13131a',
  },
  msgInput: {
    flex: 1, background: '#0f0f10', border: '1px solid #2a2a35',
    borderRadius: 12, padding: '11px 14px', color: '#e8e8e8', fontSize: 14,
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff', borderRadius: 12, width: 44, height: 44, fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'opacity 0.2s', border: 'none', cursor: 'pointer',
  },
};