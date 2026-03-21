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
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(null);
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
      if (!selected) return;
      const isRelevant =
        (Number(msg.sender_id) === currentUserId && Number(msg.receiver_id) === Number(selected.id)) ||
        (Number(msg.sender_id) === Number(selected.id) && Number(msg.receiver_id) === currentUserId);
      if (isRelevant) {
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleOnlineUsers = (ids) => setOnlineUsers(ids.map(Number));

    socket.on('private_message', handleMessage);
    socket.on('online_users', handleOnlineUsers);

    return () => {
      socket.off('private_message', handleMessage);
      socket.off('online_users', handleOnlineUsers);
    };
  }, [currentUserId]);

  const selectUser = useCallback(async (user) => {
    setSelectedUser(user);
    selectedUserRef.current = user;
    setMessages([]);
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

  const sendMessage = () => {
    const socket = getSocket();
    if (!socket || !input.trim() || !selectedUser) return;
    socket.emit('private_message', { to: Number(selectedUser.id), content: input.trim() });
    setInput('');
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
          {filteredUsers.map(user => (
            <div
              key={user.id}
              style={{
                ...s.userItem,
                background: selectedUser?.id === user.id ? '#252530' : 'transparent',
              }}
              onClick={() => selectUser(user)}
            >
              <div style={s.avatarSm}>{user.username[0].toUpperCase()}</div>
              <div style={s.userInfo}>
                <span style={s.userName}>{user.username}</span>
                <span style={{ ...s.status, color: isOnline(user.id) ? '#4ade80' : '#555' }}>
                  {isOnline(user.id) ? '● Online' : '○ Offline'}
                </span>
              </div>
            </div>
          ))}
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
              <div style={s.avatarSm}>{selectedUser.username[0].toUpperCase()}</div>
              <div>
                <div style={s.chatName}>{selectedUser.username}</div>
                <div style={{ fontSize: 12, color: isOnline(selectedUser.id) ? '#4ade80' : '#555' }}>
                  {isOnline(selectedUser.id) ? 'Online' : 'Offline'}
                </div>
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
                      <div style={{ ...s.time, textAlign: mine ? 'right' : 'left' }}>
                        {formatTime(msg.created_at)}
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
                onChange={e => setInput(e.target.value)}
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
  logoutBtn: {
    marginLeft: 'auto', background: 'none', color: '#555',
    fontSize: 18, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
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