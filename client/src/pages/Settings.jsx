import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { disconnectSocket } from '../socket';

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

export default function Settings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const [username, setUsername] = useState(currentUser.username || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [selectedColor, setSelectedColor] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [usernameMsg, setUsernameMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');
  const [prefsMsg, setPrefsMsg] = useState('');
  const [usernameErr, setUsernameErr] = useState(false);
  const [passwordErr, setPasswordErr] = useState(false);
  const [deleteErr, setDeleteErr] = useState(false);

  const getInitial = (name) => name?.[0]?.toUpperCase() || '?';
  const getGradient = (idx) => `linear-gradient(135deg, ${avatarColors[idx][0]}, ${avatarColors[idx][1]})`;

  // Load preferences from DB on mount
  useEffect(() => {
    axios.get(`${API}/api/auth/preferences`, { headers })
      .then(({ data }) => {
        setSelectedColor(data.avatar_color ?? 0);
        setDarkMode(data.dark_mode === 1);
        setSoundOn(data.sound_on !== 0);
        localStorage.setItem('darkMode', data.dark_mode === 1);
        localStorage.setItem('soundOn', data.sound_on !== 0);
        localStorage.setItem('avatarColor', data.avatar_color ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Apply dark mode to body
  useEffect(() => {
    document.body.style.background = darkMode
      ? 'linear-gradient(145deg, #0f0f1a 0%, #1a1025 50%, #0f1a25 100%)'
      : 'linear-gradient(145deg, #eef2ff 0%, #f5f0ff 40%, #fdf4ff 70%, #fff1f5 100%)';
  }, [darkMode]);

  // Save appearance preferences to DB
  const handleSavePreferences = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/api/auth/preferences`, {
        avatar_color: selectedColor,
        dark_mode: darkMode,
        sound_on: soundOn,
      }, { headers });
      localStorage.setItem('darkMode', darkMode);
      localStorage.setItem('soundOn', soundOn);
      localStorage.setItem('avatarColor', selectedColor);
      setPrefsMsg('Preferences saved!');
    } catch (err) {
      setPrefsMsg('Failed to save preferences');
    } finally {
      setSaving(false);
      setTimeout(() => setPrefsMsg(''), 3000);
    }
  };

  const handleUsernameUpdate = async () => {
    try {
      const { data } = await axios.put(`${API}/api/auth/update-username`, { username }, { headers });
      const updated = { ...currentUser, username: data.user.username };
      localStorage.setItem('user', JSON.stringify(updated));
      setCurrentUser(updated);
      setUsernameErr(false);
      setUsernameMsg('Username updated successfully!');
    } catch (err) {
      setUsernameErr(true);
      setUsernameMsg(err.response?.data?.error || 'Failed to update username');
    }
    setTimeout(() => setUsernameMsg(''), 3000);
  };

  const handlePasswordUpdate = async () => {
    try {
      await axios.put(`${API}/api/auth/update-password`, { currentPassword, newPassword }, { headers });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordErr(false);
      setPasswordMsg('Password updated successfully!');
    } catch (err) {
      setPasswordErr(true);
      setPasswordMsg(err.response?.data?.error || 'Failed to update password');
    }
    setTimeout(() => setPasswordMsg(''), 3000);
  };

  const handleDeleteAccount = async () => {
    try {
      await axios.delete(`${API}/api/auth/delete-account`, {
        headers, data: { password: deletePassword }
      });
      disconnectSocket();
      localStorage.clear();
      navigate('/register');
    } catch (err) {
      setDeleteErr(true);
      setDeleteMsg(err.response?.data?.error || 'Failed to delete account');
      setTimeout(() => setDeleteMsg(''), 3000);
    }
  };

  const handleLogout = () => {
    disconnectSocket();
    localStorage.clear();
    navigate('/login');
  };

  const bg = darkMode
    ? 'linear-gradient(145deg, #0f0f1a 0%, #1a1025 50%, #0f1a25 100%)'
    : 'linear-gradient(145deg, #eef2ff 0%, #f5f0ff 40%, #fdf4ff 70%, #fff1f5 100%)';

  const cardBg = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)';
  const cardBorder = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
  const textPrimary = darkMode ? '#f1f5f9' : '#0f172a';
  const textSecondary = darkMode ? '#94a3b8' : '#64748b';
  const inputBg = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(241,245,249,0.8)';
  const inputBorder = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.15)';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>Loading preferences...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', height: '100vh', background: bg, padding: '20px 16px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button
            onClick={() => navigate('/chat')}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: textPrimary }}>Settings</div>
            <div style={{ fontSize: 13, color: textSecondary }}>Manage your account & preferences</div>
          </div>
        </div>

        {/* Profile Preview */}
        <div style={{ ...card(cardBg, cardBorder), display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: getGradient(selectedColor), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26, color: '#fff', boxShadow: '0 4px 16px rgba(99,102,241,0.3)', flexShrink: 0 }}>
            {getInitial(currentUser.username)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: textPrimary }}>{currentUser.username}</div>
            <div style={{ fontSize: 13, color: textSecondary }}>{currentUser.email}</div>
          </div>
        </div>

        {/* Appearance */}
        <div style={card(cardBg, cardBorder)}>
          <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary, marginBottom: 16 }}>Appearance</div>

          {/* Avatar Color */}
          <div style={{ marginBottom: 20 }}>
            <div style={sectionTitle(textSecondary)}>Avatar Color</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              {avatarColors.map((color, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedColor(idx)}
                  style={{
                    width: 40, height: 40, borderRadius: 12, cursor: 'pointer',
                    background: `linear-gradient(135deg, ${color[0]}, ${color[1]})`,
                    boxShadow: selectedColor === idx
                      ? `0 0 0 3px ${darkMode ? '#1a1025' : '#fff'}, 0 0 0 5px ${color[0]}`
                      : '0 2px 8px rgba(0,0,0,0.15)',
                    transform: selectedColor === idx ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Dark Mode */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Dark Mode</div>
              <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>Switch between light and dark theme</div>
            </div>
            <div onClick={() => setDarkMode(!darkMode)} style={{ ...toggle(darkMode), flexShrink: 0 }}>
              <div style={toggleKnob(darkMode)} />
            </div>
          </div>

          {/* Sound */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>Notification Sound</div>
              <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>Play a sound on new messages</div>
            </div>
            <div onClick={() => setSoundOn(!soundOn)} style={{ ...toggle(soundOn), flexShrink: 0 }}>
              <div style={toggleKnob(soundOn)} />
            </div>
          </div>

          {prefsMsg && <div style={{ ...msgStyle(false), marginTop: 12 }}>{prefsMsg}</div>}

          <button
            style={{ ...actionBtn, marginTop: 16, opacity: saving ? 0.7 : 1 }}
            onClick={handleSavePreferences}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Appearance'}
          </button>
        </div>

        {/* Change Username */}
        <div style={card(cardBg, cardBorder)}>
          <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary, marginBottom: 4 }}>Change Username</div>
          <div style={{ fontSize: 13, color: textSecondary, marginBottom: 4 }}>Update how others see your name</div>
          <input
            style={inputStyle(inputBg, inputBorder, textPrimary)}
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="New username"
          />
          {usernameMsg && <div style={msgStyle(usernameErr)}>{usernameMsg}</div>}
          <button style={actionBtn} onClick={handleUsernameUpdate}>Update Username</button>
        </div>

        {/* Change Password */}
        <div style={card(cardBg, cardBorder)}>
          <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary, marginBottom: 4 }}>Change Password</div>
          <div style={{ fontSize: 13, color: textSecondary, marginBottom: 4 }}>Keep your account secure</div>
          <input
            style={{ ...inputStyle(inputBg, inputBorder, textPrimary), marginBottom: 10 }}
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Current password"
          />
          <input
            style={inputStyle(inputBg, inputBorder, textPrimary)}
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="New password (min 6 chars)"
          />
          {passwordMsg && <div style={msgStyle(passwordErr)}>{passwordMsg}</div>}
          <button style={actionBtn} onClick={handlePasswordUpdate}>Update Password</button>
        </div>

        {/* Logout */}
        <div style={card(cardBg, cardBorder)}>
          <div style={{ fontSize: 16, fontWeight: 800, color: textPrimary, marginBottom: 4 }}>Sign Out</div>
          <div style={{ fontSize: 13, color: textSecondary, marginBottom: 14 }}>
            You will be signed out of your account on this device.
          </div>
          <button
            onClick={handleLogout}
            style={{ ...actionBtn, background: 'rgba(99,102,241,0.1)', color: '#6366f1', boxShadow: 'none' }}
          >
            Sign out
          </button>
        </div>

        {/* Delete Account */}
        <div style={{ ...card(cardBg, 'rgba(239,68,68,0.2)'), marginBottom: 40 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#ef4444', marginBottom: 4 }}>Delete Account</div>
          <div style={{ fontSize: 13, color: textSecondary, marginBottom: 14 }}>
            Permanently deletes your account, messages, and all data. This cannot be undone.
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ ...actionBtn, background: 'rgba(239,68,68,0.1)', color: '#ef4444', boxShadow: 'none' }}
            >
              Delete my account
            </button>
          ) : (
            <>
              <input
                style={{ ...inputStyle(inputBg, 'rgba(239,68,68,0.2)', textPrimary), marginBottom: 10 }}
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Enter your password to confirm"
              />
              {deleteMsg && <div style={msgStyle(deleteErr)}>{deleteMsg}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleDeleteAccount}
                  style={{ ...actionBtn, background: 'linear-gradient(135deg, #ef4444, #dc2626)', flex: 1 }}
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                  style={{ ...actionBtn, background: 'rgba(0,0,0,0.05)', color: '#64748b', boxShadow: 'none', flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

const card = (bg, border) => ({
  background: bg,
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20, padding: '20px',
  border: `1px solid ${border}`,
  boxShadow: '0 4px 24px rgba(99,102,241,0.08)',
  marginBottom: 16,
});

const sectionTitle = (color) => ({
  fontSize: 13, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: 0.5,
});

const inputStyle = (bg, border, color) => ({
  width: '100%', background: bg,
  border: `1.5px solid ${border}`,
  borderRadius: 12, padding: '12px 14px',
  fontSize: 14, color, fontWeight: 500,
  marginTop: 10,
});

const msgStyle = (isErr) => ({
  fontSize: 13, marginTop: 8, padding: '8px 12px', borderRadius: 8,
  background: isErr ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
  color: isErr ? '#ef4444' : '#22c55e',
  border: `1px solid ${isErr ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
});

const actionBtn = {
  width: '100%', marginTop: 14,
  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
  color: '#fff', borderRadius: 12, padding: '13px',
  fontSize: 14, fontWeight: 700,
  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
};

const toggle = (on) => ({
  width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
  background: on ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(0,0,0,0.15)',
  position: 'relative', transition: 'background 0.3s',
  boxShadow: on ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
});

const toggleKnob = (on) => ({
  position: 'absolute', top: 3,
  left: on ? 25 : 3,
  width: 20, height: 20, borderRadius: '50%',
  background: '#fff', transition: 'left 0.3s',
  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
});