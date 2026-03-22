import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { connectSocket } from '../socket';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await axios.post('http://localhost:3001/api/auth/register', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      connectSocket(data.token);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.blob1} />
      <div style={s.blob2} />
      <div style={s.blob3} />

      <div style={s.card}>
        <div style={s.logoWrap}>
          <div style={s.logoRing}>
            <span style={s.logoEmoji}>💬</span>
          </div>
          <div style={s.appName}>Chattr</div>
        </div>

        <h1 style={s.title}>Create account</h1>
        <p style={s.sub}>Join thousands of people chatting 🚀</p>

        {error && (
          <div style={s.error}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={{ ...s.field, borderColor: focused === 'username' ? '#6366f1' : 'rgba(99,102,241,0.15)' }}>
            <span style={s.fieldIcon}>👤</span>
            <input
              style={s.input}
              type="text"
              placeholder="Username"
              value={form.username}
              onFocus={() => setFocused('username')}
              onBlur={() => setFocused('')}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div style={{ ...s.field, borderColor: focused === 'email' ? '#6366f1' : 'rgba(99,102,241,0.15)' }}>
            <span style={s.fieldIcon}>✉️</span>
            <input
              style={s.input}
              type="email"
              placeholder="Email address"
              value={form.email}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused('')}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div style={{ ...s.field, borderColor: focused === 'password' ? '#6366f1' : 'rgba(99,102,241,0.15)' }}>
            <span style={s.fieldIcon}>🔑</span>
            <input
              style={s.input}
              type="password"
              placeholder="Password (min 6 chars)"
              value={form.password}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused('')}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button style={{ ...s.btn, opacity: loading ? 0.8 : 1 }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create account →'}
          </button>
        </form>

        <div style={s.divider}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>or</span>
          <div style={s.dividerLine} />
        </div>

        <p style={s.linkRow}>
          Already have an account?{' '}
          <Link to="/login" style={s.linkA}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(145deg, #eef2ff 0%, #f5f0ff 40%, #fdf2ff 70%, #fff0f6 100%)',
    position: 'relative', overflow: 'hidden', padding: 20,
  },
  blob1: {
    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
    top: '-100px', left: '-100px', pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute', width: 350, height: 350, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)',
    bottom: '-80px', right: '-80px', pointerEvents: 'none',
  },
  blob3: {
    position: 'absolute', width: 250, height: 250, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)',
    top: '40%', right: '10%', pointerEvents: 'none',
  },
  card: {
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
    borderRadius: 32, padding: '48px 44px',
    width: '100%', maxWidth: 420, position: 'relative', zIndex: 1,
    border: '1px solid rgba(255,255,255,0.9)',
    boxShadow: '0 20px 60px rgba(99,102,241,0.12), 0 4px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
    animation: 'fadeIn 0.4s ease',
  },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 },
  logoRing: {
    width: 72, height: 72, borderRadius: 22,
    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(99,102,241,0.4), 0 2px 8px rgba(0,0,0,0.1)',
    marginBottom: 10,
  },
  logoEmoji: { fontSize: 32 },
  appName: {
    fontSize: 13, fontWeight: 700, letterSpacing: 3,
    textTransform: 'uppercase',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  title: { fontSize: 28, fontWeight: 800, color: '#0f0f1a', textAlign: 'center', marginBottom: 6 },
  sub: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 28 },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  field: {
    display: 'flex', alignItems: 'center',
    background: 'rgba(248,248,255,0.8)',
    border: '1.5px solid rgba(99,102,241,0.15)',
    borderRadius: 16, padding: '0 16px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: '0 2px 8px rgba(99,102,241,0.04)',
  },
  fieldIcon: { fontSize: 16, marginRight: 10, flexShrink: 0 },
  input: {
    flex: 1, background: 'none', border: 'none',
    padding: '14px 0', color: '#0f0f1a', fontSize: 14, fontWeight: 500,
  },
  btn: {
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
    color: '#fff', borderRadius: 16, padding: '15px',
    fontSize: 15, fontWeight: 700, marginTop: 4,
    boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
    letterSpacing: 0.3,
  },
  error: {
    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
    borderRadius: 12, padding: '11px 14px',
    color: '#ef4444', fontSize: 13, marginBottom: 8,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' },
  dividerLine: { flex: 1, height: 1, background: 'rgba(99,102,241,0.1)' },
  dividerText: { fontSize: 12, color: '#94a3b8', fontWeight: 500 },
  linkRow: { textAlign: 'center', fontSize: 14, color: '#64748b' },
  linkA: {
    fontWeight: 700, marginLeft: 4,
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
};