import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../index.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.status === 401 || response.status === 403) {
        setError('Benutzername oder Passwort falsch.');
        return;
      }
      if (!response.ok) {
        throw new Error('Server error');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/portal');
    } catch (err: any) {
      if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
        setError('Backend-Server ist noch nicht erreichbar. Der Server wird gerade eingerichtet — bitte in Kürze erneut versuchen.');
      } else {
        setError('Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.');
      }
    }
  };

  return (
    <div className="container login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo.png" alt="Helferchen" style={{ height: '64px', width: 'auto' }} />
        </div>
        <h2>Mitarbeiter-Login</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Benutzername"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary">Anmelden</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem' }}>
          Noch kein Konto? <Link to="/registrieren">Als Helfer:in registrieren</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
