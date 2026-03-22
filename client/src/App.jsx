import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { connectSocket, getSocket } from './socket';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [socketReady, setSocketReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setSocketReady(true); return; }

    const existing = getSocket();
    if (existing && existing.connected) { setSocketReady(true); return; }

    const socket = connectSocket(token);
    socket.on('connect', () => setSocketReady(true));
    socket.on('connect_error', () => setSocketReady(true));
    if (socket.connected) setSocketReady(true);
  }, []);

  if (!socketReady) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </BrowserRouter>
  );
}