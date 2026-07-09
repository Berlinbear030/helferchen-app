import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../index.css';

const MIN_AGE = 18;

function calcAge(birthDateStr: string): number | null {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Registrierung() {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const age = calcAge(birthDate);
  const tooYoung = age !== null && age < MIN_AGE;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setFileName(''); setFileData(''); return; }
    if (file.size > 8 * 1024 * 1024) {
      setError('Datei zu groß (max. 8 MB).');
      setFileName(''); setFileData('');
      return;
    }
    setError('');
    setFileName(file.name);
    setFileData(await fileToDataUrl(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tooYoung) {
      setError(`Registrierung nicht möglich: Mindestalter ${MIN_AGE} Jahre.`);
      return;
    }
    if (!fileData) {
      setError('Bitte laden Sie Ihr Führungszeugnis hoch.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/onboarding/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username, password, full_name: fullName, email,
          birth_date: birthDate, address, criminal_record_upload: fileData,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || 'Registrierung fehlgeschlagen.');
        return;
      }
      setSuccess(true);
    } catch (err: any) {
      if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
        setError('Backend-Server ist noch nicht erreichbar. Bitte in Kürze erneut versuchen.');
      } else {
        setError('Registrierung fehlgeschlagen. Bitte Angaben prüfen.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="container login-container">
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img src="/logo.png" alt="Helferchen" style={{ height: '64px', width: 'auto' }} />
          </div>
          <h2>Registrierung eingereicht</h2>
          <p style={{ textAlign: 'center', color: '#374151', lineHeight: 1.5 }}>
            Vielen Dank! Ihre Bewerbung wird nun von einem Gebietsleiter geprüft. Sie erhalten Zugang zum Portal, sobald Ihr Profil freigegeben wurde.
          </p>
          <button className="btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={() => navigate('/login')}>
            Zum Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container login-container">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img src="/logo.png" alt="Helferchen" style={{ height: '64px', width: 'auto' }} />
        </div>
        <h2>Als Helfer:in registrieren</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Vollständiger Name *</label>
            <input required value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Benutzername *</label>
            <input required value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Passwort *</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label>E-Mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Geburtsdatum *</label>
            <input type="date" required value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            {tooYoung && <span style={{ color: '#991B1B', fontSize: '0.85rem' }}>Mindestalter {MIN_AGE} Jahre erforderlich.</span>}
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Straße, PLZ Ort" />
          </div>
          <div className="form-group">
            <label>Führungszeugnis (PDF oder Foto) *</label>
            <input type="file" accept=".pdf,image/*" required onChange={handleFile} />
            {fileName && <span style={{ fontSize: '0.85rem', color: '#374151' }}>📎 {fileName}</span>}
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '8px' }} disabled={submitting || tooYoung}>
            {submitting ? 'Wird eingereicht…' : 'Registrierung einreichen'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem' }}>
          Bereits registriert? <Link to="/login">Zum Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Registrierung;
