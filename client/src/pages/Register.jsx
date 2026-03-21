import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { connectSocket } from '../socket';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>💬</div>
        <h1 style={styles.title}>Create account</h1>
        <p style={styles.sub}>Start chatting in seconds</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password (min 6 chars)"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
          />
          <button style={{ ...styles.btn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p style={styles.link}>
          Have an account? <Link to="/login" style={styles.linkA}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#0f0f10',
  },
  card: {
    background: '#1a1a1f', borderRadius: 16, padding: '40px 36px',
    width: '100%', maxWidth: 380, border: '1px solid #2a2a35',
  },
  logo: { fontSize: 36, marginBottom: 16, textAlign: 'center' },
  title: { fontSize: 24, fontWeight: 600, textAlign: 'center', color: '#fff', marginBottom: 4 },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 28 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    background: '#0f0f10', border: '1px solid #2a2a35', borderRadius: 10,
    padding: '12px 14px', color: '#e8e8e8', fontSize: 14,
  },
  btn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff', borderRadius: 10, padding: '13px', fontSize: 15,
    fontWeight: 600, marginTop: 4, border: 'none', cursor: 'pointer',
  },
  error: {
    background: '#2a1515', border: '1px solid #5a2020', borderRadius: 8,
    padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 12,
  },
  link: { textAlign: 'center', fontSize: 13, color: '#888', marginTop: 20 },
  linkA: { color: '#818cf8', fontWeight: 500 },
};