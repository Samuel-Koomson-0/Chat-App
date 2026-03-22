import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSocket, disconnectSocket } from '../socket';

const API = 'http://localhost:3001';

const avatarColors = [
  ['#6366f1', '#a855f7'],
  ['#ec4899', '#f43f5e'],
  ['#06b6d4', '#3b82f6'],
  ['#10b981', '#06b6d4'],
  ['#f59e0b', '#ef4444'],
  ['#8b5cf6', '#ec4899'],
  ['#14b8a6', '#6366f1'],
  ['#f97316', '#ec4899'],
];

const getGradient = (index) => {
  const i = Math.max(0, Math.min(index ?? 0, avatarColors.length - 1));
  return `linear-gradient(135deg, ${avatarColors[i][0]}, ${avatarColors[i][1]})`;
};

const getDefaultGradient = (name) => {
  const i = (name?.charCodeAt(0) || 0) % avatarColors.length;
  return `linear-gradient(135deg, ${avatarColors[i][0]}, ${avatarColors[i][1]})`;
};

export default function Chat() {
  const [tab, setTab] = useState('chats');
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sentRequests, setSentRequests] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');
  const [avatarColorIndex, setAvatarColorIndex] = useState(Number(localStorage.getItem('avatarColor') || 0));

  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const currentUserId = Number(currentUser.id);
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const textPrimary = darkMode ? '#f1f5f9' : '#0f172a';
  const textSecondary = darkMode ? '#94a3b8' : '#64748b';

  const dm = {
    layout: darkMode
      ? 'linear-gradient(145deg, #0f0f1a 0%, #1a1025 50%, #0f1a25 100%)'
      : 'linear-gradient(145deg, #eef2ff 0%, #f5f0ff 40%, #fdf4ff 70%, #fff1f5 100%)',
    sidebar: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.65)',
    header: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
    input: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
    inputBox: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(241,245,249,0.8)',
    inputBorder: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.12)',
    bubble: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
    bubbleBorder: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(226,232,240,0.8)',
    welcomeCard: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
    searchBox: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(241,245,249,0.8)',
    searchBorder: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(99,102,241,0.1)',
    border: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
    dropdown: darkMode ? 'rgba(20,10,35,0.97)' : 'rgba(255,255,255,0.97)',
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadPreferences = useCallback(() => {
    return axios.get(`${API}/api/auth/preferences`, { headers })
      .then(({ data }) => {
        const dm = data.dark_mode === 1;
        const ac = Number(data.avatar_color ?? 0);
        setDarkMode(dm);
        setAvatarColorIndex(ac);
        localStorage.setItem('darkMode', dm);
        localStorage.setItem('avatarColor', ac);
        localStorage.setItem('soundOn', data.sound_on !== 0);
      })
      .catch(console.error);
  }, []);

  const loadContacts = useCallback(() => {
    return axios.get(`${API}/api/contacts`, { headers })
      .then(r => setContacts(r.data)).catch(console.error);
  }, []);

  const loadRequests = useCallback(() => {
    axios.get(`${API}/api/requests`, { headers })
      .then(r => setRequests(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    loadPreferences();
    loadContacts();
    loadRequests();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API}/api/users/search?q=${searchQuery}`, { headers });
        setSearchResults(data);
      } catch (err) { console.error(err); }
    }, 400);
  }, [searchQuery]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMessage = (msg) => {
      const selected = selectedUserRef.current;
      const senderId = Number(msg.sender_id);
      if (senderId === currentUserId) {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        return;
      }
      if (selected && senderId === Number(selected.id)) {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        setTypingUsers(prev => ({ ...prev, [senderId]: false }));
        socket.emit('mark_read', { from: senderId });
      } else {
        setUnreadCounts(prev => ({ ...prev, [senderId]: (prev[senderId] || 0) + 1 }));
      }
      if (localStorage.getItem('soundOn') !== 'false') {
        const audio = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => {});
      }
    };

    const handleOnlineUsers = (ids) => setOnlineUsers(ids.map(Number));
    const handleTyping = ({ from, isTyping }) => setTypingUsers(prev => ({ ...prev, [from]: isTyping }));
    const handleMessagesRead = ({ messageIds }) => {
      setMessages(prev => prev.map(m => messageIds.includes(m.id) ? { ...m, is_read: 1 } : m));
    };
    const handleNewRequest = (req) => setRequests(prev => [...prev, req]);
    const handleRequestAccepted = () => { loadContacts(); setTab('chats'); };
    const handlePrefsUpdated = () => { loadPreferences(); loadContacts(); };

    socket.on('private_message', handleMessage);
    socket.on('online_users', handleOnlineUsers);
    socket.on('typing', handleTyping);
    socket.on('messages_read', handleMessagesRead);
    socket.on('new_request', handleNewRequest);
    socket.on('request_accepted', handleRequestAccepted);
    socket.on('prefs_updated', handlePrefsUpdated);

    return () => {
      socket.off('private_message', handleMessage);
      socket.off('online_users', handleOnlineUsers);
      socket.off('typing', handleTyping);
      socket.off('messages_read', handleMessagesRead);
      socket.off('new_request', handleNewRequest);
      socket.off('request_accepted', handleRequestAccepted);
      socket.off('prefs_updated', handlePrefsUpdated);
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
      const { data } = await axios.get(`${API}/api/messages/${user.id}`, { headers });
      setMessages(data);
    } catch (err) { console.error(err); }
  }, [token]);

  const goBack = () => { setSelectedUser(null); selectedUserRef.current = null; setMessages([]); };

  const sendRequest = async (user) => {
    try {
      await axios.post(`${API}/api/requests/send`, { to: user.id }, { headers });
      setSentRequests(prev => ({ ...prev, [user.id]: true }));
    } catch (err) { console.error(err); }
  };

  const acceptRequest = async (senderId) => {
    try {
      await axios.post(`${API}/api/requests/accept`, { from: senderId }, { headers });
      setRequests(prev => prev.filter(r => r.sender_id !== senderId));
      await loadContacts();
      setTab('chats');
    } catch (err) { console.error(err); }
  };

  const declineRequest = async (senderId) => {
    try {
      await axios.post(`${API}/api/requests/decline`, { from: senderId }, { headers });
      setRequests(prev => prev.filter(r => r.sender_id !== senderId));
    } catch (err) { console.error(err); }
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const logout = () => { disconnectSocket(); localStorage.clear(); navigate('/login'); };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isOnline = (userId) => onlineUsers.includes(Number(userId));
  const isTyping = (userId) => typingUsers[Number(userId)] === true;
  const getInitial = (name) => name?.[0]?.toUpperCase() || '?';

  const renderTicks = (msg) => {
    if (Number(msg.sender_id) !== currentUserId) return null;
    return msg.is_read
      ? <span style={s.ticksRead}>✓✓</span>
      : <span style={s.ticksSent}>✓</span>;
  };

  const showSidebar = !isMobile || !selectedUser;
  const showMain = !isMobile || !!selectedUser;

  return (
    <div style={{ ...s.layout, background: dm.layout }}>
      <div style={s.bgBlob1} />
      <div style={s.bgBlob2} />

      {showSidebar && (
        <aside style={{ ...s.sidebar, width: isMobile ? '100%' : 310, background: dm.sidebar, borderRight: `1px solid ${dm.border}` }}>

          {/* Profile header */}
          <div style={{ ...s.profileHeader, borderBottom: `1px solid ${dm.border}` }}>
            <div style={{ ...s.myAvatar, background: getGradient(avatarColorIndex) }}>
              {getInitial(currentUser.username)}
            </div>
            <div style={s.profileInfo}>
              <div style={{ ...s.profileName, color: textPrimary }}>{currentUser.username}</div>
              <div style={s.profileStatus}><span style={s.statusDot} />Active</div>
            </div>
            <button onClick={() => navigate('/settings')} style={s.iconBtn} title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </div>

          {/* Search */}
          <div style={s.searchSection}>
            <div style={{ ...s.searchBox, background: dm.searchBox, border: `1.5px solid ${dm.searchBorder}` }}>
              <svg style={{ flexShrink: 0, opacity: 0.5 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                style={{ ...s.searchInput, color: textPrimary }}
                placeholder="Search people..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} style={s.clearBtn}>✕</button>
              )}
            </div>

            {searchResults.length > 0 && (
              <div style={{ ...s.dropdown, background: dm.dropdown }}>
                {searchResults.map(user => (
                  <div key={user.id} style={{ ...s.dropdownItem, borderBottom: `1px solid ${dm.border}` }}>
                    <div style={{ ...s.dropAvatar, background: user.avatar_color != null ? getGradient(user.avatar_color) : getDefaultGradient(user.username) }}>
                      {getInitial(user.username)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...s.dropName, color: textPrimary }}>{user.username}</div>
                    </div>
                    <button
                      style={{ ...s.addBtn, opacity: sentRequests[user.id] ? 0.6 : 1 }}
                      onClick={() => sendRequest(user)}
                      disabled={sentRequests[user.id]}
                    >
                      {sentRequests[user.id] ? '✓' : '+'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ ...s.tabRow, borderBottom: `1px solid ${dm.border}` }}>
            <button style={{ ...s.tab, ...(tab === 'chats' ? s.tabOn : { color: textSecondary }) }} onClick={() => setTab('chats')}>
              Chats
            </button>
            <button style={{ ...s.tab, ...(tab === 'requests' ? s.tabOn : { color: textSecondary }) }} onClick={() => setTab('requests')}>
              Requests
              {requests.length > 0 && <span style={s.tabBadge}>{requests.length}</span>}
            </button>
          </div>

          {/* List */}
          <div style={s.list}>
            {tab === 'chats' && (
              contacts.length === 0 ? (
                <div style={s.emptyWrap}>
                  <div style={s.emptyIcon}>👥</div>
                  <div style={{ ...s.emptyTitle, color: textSecondary }}>No contacts yet</div>
                  <div style={{ ...s.emptySub, color: textSecondary }}>Search for people to get started</div>
                </div>
              ) : contacts.map(user => {
                const unread = unreadCounts[user.id] || 0;
                const active = selectedUser?.id === user.id;
                const userGradient = user.avatar_color != null ? getGradient(user.avatar_color) : getDefaultGradient(user.username);
                return (
                  <div
                    key={user.id}
                    style={{ ...s.contactRow, background: active ? 'rgba(99,102,241,0.08)' : 'transparent' }}
                    onClick={() => selectUser(user)}
                  >
                    <div style={s.contactAvatarWrap}>
                      <div style={{ ...s.contactAvatar, background: userGradient }}>
                        {getInitial(user.username)}
                      </div>
                      {isOnline(user.id) && <div style={s.onlinePip} />}
                    </div>
                    <div style={s.contactMeta}>
                      <div style={{ ...s.contactName, color: textPrimary }}>{user.username}</div>
                      <div style={s.contactSub}>
                        {isTyping(user.id)
                          ? <span style={{ color: '#a855f7' }}>typing...</span>
                          : unread > 0
                            ? <span style={{ color: '#6366f1', fontWeight: 600 }}>
                                {unread === 1 ? '1 new message' : `${unread > 9 ? '9+' : unread} new messages`}
                              </span>
                            : <span style={{ color: textSecondary }}>{isOnline(user.id) ? 'Online' : 'Offline'}</span>
                        }
                      </div>
                    </div>
                    {unread > 0 && <div style={s.unreadPill}>{unread > 9 ? '9+' : unread}</div>}
                    {active && !isMobile && <div style={s.activeLine} />}
                  </div>
                );
              })
            )}

            {tab === 'requests' && (
              requests.length === 0 ? (
                <div style={s.emptyWrap}>
                  <div style={s.emptyIcon}>📭</div>
                  <div style={{ ...s.emptyTitle, color: textSecondary }}>No requests</div>
                  <div style={{ ...s.emptySub, color: textSecondary }}>You're all caught up!</div>
                </div>
              ) : requests.map(req => (
                <div key={req.id} style={{ ...s.reqCard, borderBottom: `1px solid ${dm.border}` }}>
                  <div style={{ ...s.contactAvatar, background: getDefaultGradient(req.sender_username), width: 44, height: 44, fontSize: 16 }}>
                    {getInitial(req.sender_username)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...s.contactName, color: textPrimary }}>{req.sender_username}</div>
                    <div style={{ fontSize: 12, color: textSecondary, marginBottom: 10 }}>wants to connect with you</div>
                    <div style={s.reqBtnRow}>
                      <button style={s.acceptBtn} onClick={() => acceptRequest(req.sender_id)}>Accept</button>
                      <button style={s.declineBtn} onClick={() => declineRequest(req.sender_id)}>Decline</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      {showMain && (
        <main style={{ ...s.main, width: isMobile ? '100%' : 'auto' }}>
          {!selectedUser ? (
            <div style={s.welcomeWrap}>
              <div style={{ ...s.welcomeCard, background: dm.welcomeCard }}>
                <div style={s.welcomeIcon}>💬</div>
                <div style={{ ...s.welcomeTitle, color: textPrimary }}>Welcome to Chattr</div>
                <div style={{ ...s.welcomeSub, color: textSecondary }}>Select a conversation or search for someone new</div>
              </div>
            </div>
          ) : (
            <div style={s.chatWrap}>
              {/* Header */}
              <div style={{ ...s.chatHeader, background: dm.header, borderBottom: `1px solid ${dm.border}` }}>
                <button onClick={goBack} style={s.backBtn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 5l-7 7 7 7"/>
                  </svg>
                </button>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ ...s.contactAvatar, background: selectedUser.avatar_color != null ? getGradient(selectedUser.avatar_color) : getDefaultGradient(selectedUser.username), width: 40, height: 40, fontSize: 15 }}>
                    {getInitial(selectedUser.username)}
                  </div>
                  {isOnline(selectedUser.id) && <div style={s.onlinePipLg} />}
                </div>
                <div style={s.headerInfo}>
                  <div style={{ ...s.headerName, color: textPrimary }}>{selectedUser.username}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: isTyping(selectedUser.id) ? '#a855f7' : isOnline(selectedUser.id) ? '#22c55e' : '#94a3b8' }}>
                    {isTyping(selectedUser.id) ? '✎ typing...' : isOnline(selectedUser.id) ? '● Active now' : '○ Offline'}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={s.msgArea}>
                {messages.length === 0 && (
                  <div style={s.noMsg}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
                    <div style={{ fontWeight: 600, color: textSecondary, marginBottom: 4 }}>Say hello!</div>
                    <div style={{ fontSize: 13, color: textSecondary }}>Start a conversation with {selectedUser.username}</div>
                  </div>
                )}
                {messages.map((msg) => {
                  const mine = Number(msg.sender_id) === currentUserId;
                  const msgAvatar = selectedUser.avatar_color != null
                    ? getGradient(selectedUser.avatar_color)
                    : getDefaultGradient(selectedUser.username);
                  return (
                    <div key={msg.id} style={{ ...s.msgRow, justifyContent: mine ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.2s ease' }}>
                      {!mine && (
                        <div style={{ ...s.msgAvatar, background: msgAvatar }}>
                          {getInitial(selectedUser.username)}
                        </div>
                      )}
                      <div style={{ maxWidth: isMobile ? '78%' : '62%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          ...s.bubble,
                          background: mine ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)' : dm.bubble,
                          color: mine ? '#fff' : textPrimary,
                          borderRadius: mine ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                          boxShadow: mine ? '0 4px 20px rgba(99,102,241,0.35)' : '0 2px 12px rgba(0,0,0,0.07)',
                          border: mine ? 'none' : `1px solid ${dm.bubbleBorder}`,
                          display: 'flex', alignItems: 'flex-end', gap: 8,
                        }}>
                          <span style={{ lineHeight: 1.55, wordBreak: 'break-word' }}>{msg.content}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, flexShrink: 0, marginBottom: 1, color: mine ? 'rgba(255,255,255,0.65)' : '#94a3b8' }}>
                            {formatTime(msg.created_at)}
                            {renderTicks(msg)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ ...s.inputArea, background: dm.input, borderTop: `1px solid ${dm.border}` }}>
                <div style={{ ...s.inputBox, background: dm.inputBox, border: `1.5px solid ${dm.inputBorder}` }}>
                  <input
                    style={{ ...s.textInput, color: textPrimary }}
                    placeholder={`Message ${selectedUser.username}...`}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    style={{ ...s.sendBtn, opacity: input.trim() ? 1 : 0.45 }}
                    onClick={sendMessage}
                    disabled={!input.trim()}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

const s = {
  layout: { display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' },
  bgBlob1: { position: 'fixed', width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%)', top: '-150px', left: '-150px' },
  bgBlob2: { position: 'fixed', width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 65%)', bottom: '-100px', right: '-100px' },
  sidebar: { display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', zIndex: 1, height: '100vh', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '4px 0 24px rgba(99,102,241,0.07)' },
  profileHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 18px 16px' },
  myAvatar: { width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, color: '#fff', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' },
  profileInfo: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 15, fontWeight: 700, marginBottom: 3 },
  profileStatus: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#22c55e', fontWeight: 500 },
  statusDot: { width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' },
  iconBtn: { width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'rgba(99,102,241,0.07)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  searchSection: { padding: '12px 14px 0', position: 'relative' },
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, borderRadius: 14, padding: '0 14px' },
  searchInput: { flex: 1, background: 'none', border: 'none', padding: '10px 0', fontSize: 13, fontWeight: 500 },
  clearBtn: { background: 'none', color: '#94a3b8', fontSize: 11, padding: '2px 4px', borderRadius: 4 },
  dropdown: { position: 'absolute', top: '100%', left: 14, right: 14, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 16, marginTop: 6, overflow: 'hidden', zIndex: 100, boxShadow: '0 8px 32px rgba(99,102,241,0.15)', border: '1px solid rgba(255,255,255,0.1)' },
  dropdownItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' },
  dropAvatar: { width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#fff', flexShrink: 0 },
  dropName: { fontSize: 13, fontWeight: 600 },
  addBtn: { width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' },
  tabRow: { display: 'flex', padding: '12px 14px 0' },
  tab: { flex: 1, background: 'none', padding: '10px 8px', fontSize: 13, fontWeight: 600, borderBottom: '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' },
  tabOn: { color: '#6366f1', borderBottom: '2px solid #6366f1' },
  tabBadge: { background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800 },
  list: { flex: 1, overflowY: 'auto', padding: '8px 0' },
  contactRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s', position: 'relative' },
  contactAvatarWrap: { position: 'relative', flexShrink: 0 },
  contactAvatar: { width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
  onlinePip: { position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: '50%', background: '#22c55e', border: '2px solid transparent' },
  onlinePipLg: { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: '50%', background: '#22c55e', border: '2.5px solid transparent' },
  contactMeta: { flex: 1, minWidth: 0 },
  contactName: { fontSize: 14, fontWeight: 700, marginBottom: 3 },
  contactSub: { fontSize: 12 },
  unreadPill: { minWidth: 22, height: 22, borderRadius: 11, background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0, boxShadow: '0 2px 8px rgba(99,102,241,0.4)' },
  activeLine: { position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, borderRadius: '0 4px 4px 0', background: 'linear-gradient(180deg, #6366f1, #a855f7)' },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', textAlign: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: 700, marginBottom: 6 },
  emptySub: { fontSize: 13, lineHeight: 1.5 },
  reqCard: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px' },
  reqBtnRow: { display: 'flex', gap: 8 },
  acceptBtn: { background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', borderRadius: 10, padding: '6px 18px', fontSize: 12, fontWeight: 700, boxShadow: '0 3px 10px rgba(99,102,241,0.35)' },
  declineBtn: { background: 'rgba(241,245,249,0.8)', color: '#64748b', borderRadius: 10, padding: '6px 18px', fontSize: 12, fontWeight: 600, border: '1px solid rgba(226,232,240,0.8)' },
  main: { flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1, height: '100vh' },
  welcomeWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  welcomeCard: { textAlign: 'center', padding: '48px 40px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: 28, border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 32px rgba(99,102,241,0.1)', animation: 'fadeIn 0.5s ease' },
  welcomeIcon: { fontSize: 52, marginBottom: 16, display: 'inline-block', background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)', borderRadius: 20, padding: '12px 16px', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' },
  welcomeTitle: { fontSize: 24, fontWeight: 800, marginBottom: 10 },
  welcomeSub: { fontSize: 14, lineHeight: 1.7 },
  chatWrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' },
  chatHeader: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 2px 16px rgba(99,102,241,0.06)', flexShrink: 0 },
  backBtn: { width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: 'rgba(99,102,241,0.08)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 16, fontWeight: 800, marginBottom: 3 },
  msgArea: { flex: 1, overflowY: 'auto', padding: '20px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 },
  noMsg: { margin: 'auto', textAlign: 'center', animation: 'fadeIn 0.4s ease' },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  msgAvatar: { width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' },
  bubble: { padding: '11px 14px', fontSize: 14, lineHeight: 1.55, wordBreak: 'break-word', fontWeight: 450 },
  ticksSent: { fontSize: 11, color: 'rgba(255,255,255,0.95)' },
  ticksRead: { fontSize: 11, color: '#fff', fontWeight: 700 },
  inputArea: { padding: '12px 16px', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', flexShrink: 0 },
  inputBox: { display: 'flex', alignItems: 'center', gap: 10, borderRadius: 20, padding: '6px 6px 6px 18px', boxShadow: '0 2px 12px rgba(99,102,241,0.07)' },
  textInput: { flex: 1, background: 'none', border: 'none', padding: '8px 0', fontSize: 14, fontWeight: 500 },
  sendBtn: { width: 40, height: 40, borderRadius: 14, flexShrink: 0, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' },
};