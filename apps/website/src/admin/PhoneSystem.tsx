import { useEffect, useRef, useState } from 'react';
import { adminApi, SipPresence, SipUser, Voicemail } from './api';

export default function PhoneSystem() {
  const [activeTab, setActiveTab] = useState<'status' | 'sip' | 'voicemail'>('status');
  const [sipUsers, setSipUsers] = useState<SipUser[]>([]);
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
  const [presence, setPresence] = useState<SipPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [presenceLoading, setPresenceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Create Sip User state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Revealed passwords state
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
    fetchPresence();
    presenceIntervalRef.current = setInterval(fetchPresence, 10000);
    return () => {
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, voicemailsData] = await Promise.all([
        adminApi.getSipUsers().catch(err => {
          console.error(err);
          return [] as SipUser[];
        }),
        adminApi.getVoicemails().catch(err => {
          console.error(err);
          return [] as Voicemail[];
        }),
      ]);
      setSipUsers(usersData);
      setVoicemails(voicemailsData);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Telefonanlagen-Daten.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPresence = async () => {
    setPresenceLoading(true);
    try {
      const data = await adminApi.getPresence();
      setPresence(data);
    } catch (_) {
      // silently keep old data on error
    } finally {
      setPresenceLoading(false);
    }
  };

  const handleCreateSipUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newFullName) {
      setCreateError('Bitte füllen Sie alle Felder aus.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await adminApi.createSipUser({
        username: newUsername,
        password: newPassword,
        full_name: newFullName,
      });
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      fetchData();
    } catch (err: any) {
      setCreateError(err.message || 'Fehler beim Erstellen des SIP-Nutzers.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSipUser = async (id: string, name: string) => {
    if (!confirm(`Soll der SIP-Nutzer "${name}" wirklich gelöscht werden?`)) return;
    try {
      await adminApi.deleteSipUser(id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Fehler beim Löschen des SIP-Nutzers.');
    }
  };

  const handleDeleteVoicemail = async (id: string) => {
    if (!confirm('Soll diese Anrufbeantworter-Nachricht gelöscht werden?')) return;
    try {
      await adminApi.deleteVoicemail(id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Fehler beim Löschen der Nachricht.');
    }
  };

  const togglePasswordReveal = (id: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs} Min.`;
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="phone-dashboard-container" style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: '#1a1a2e' }}>Telefonanlage &amp; Anrufbeantworter</h1>
          <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280' }}>Verwalten Sie Ihre Telefonanlage und hören Sie Sprachnachrichten ab.</p>
        </div>
        <button 
          onClick={fetchData} 
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            background: '#1a1a2e',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = '#2a2a4e'}
          onMouseOut={e => e.currentTarget.style.background = '#1a1a2e'}
        >
          {loading ? 'Lade...' : '🔄 Aktualisieren'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <strong>Fehler:</strong> {error}
        </div>
      )}

      {/* Tabs Menu */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: '2rem' }}>
        <button
          onClick={() => setActiveTab('status')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'status' ? '3px solid #1a1a2e' : 'none',
            color: activeTab === 'status' ? '#1a1a2e' : '#6b7280',
            fontWeight: activeTab === 'status' ? 600 : 500,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
          }}
        >
          🟢 Live-Status
          {presence.some(p => p.status === 'in_call') && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '-6px',
              background: '#ef4444',
              color: '#fff',
              borderRadius: '50%',
              padding: '0.15rem 0.4rem',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}>
              {presence.filter(p => p.status === 'in_call').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sip')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'sip' ? '3px solid #1a1a2e' : 'none',
            color: activeTab === 'sip' ? '#1a1a2e' : '#6b7280',
            fontWeight: activeTab === 'sip' ? 600 : 500,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          📞 SIP-Nutzer verwalten
        </button>
        <button
          onClick={() => setActiveTab('voicemail')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'voicemail' ? '3px solid #1a1a2e' : 'none',
            color: activeTab === 'voicemail' ? '#1a1a2e' : '#6b7280',
            fontWeight: activeTab === 'voicemail' ? 600 : 500,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
          }}
        >
          📼 Anrufbeantworter
          {voicemails.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '-6px',
              background: '#ef4444',
              color: '#fff',
              borderRadius: '50%',
              padding: '0.15rem 0.4rem',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}>
              {voicemails.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <div style={{ display: 'inline-block', width: '2.5rem', height: '2.5rem', border: '3px solid #e5e7eb', borderTopColor: '#1a1a2e', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <div>Lade Telefonanlagen-Konfiguration...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : activeTab === 'status' ? (
        /* Live-Status Tab */
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>Mitarbeiter-Status</h2>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              {presenceLoading ? 'Aktualisiere...' : 'Aktualisiert alle 10 Sek.'}
            </span>
          </div>

          {presence.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280', border: '2px dashed #e5e7eb', borderRadius: '8px' }}>
              <span style={{ fontSize: '2rem' }}>📵</span>
              <p style={{ margin: '0.5rem 0 0 0' }}>Keine SIP-Nutzer konfiguriert. Legen Sie Nebenstellen im Tab „SIP-Nutzer verwalten" an.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
              {presence.map(p => {
                const isOnline = p.status === 'online';
                const isInCall = p.status === 'in_call';
                const dotColor = isInCall ? '#ef4444' : isOnline ? '#22c55e' : '#9ca3af';
                const bg = isInCall ? '#fef2f2' : isOnline ? '#f0fdf4' : '#f9fafb';
                const border = isInCall ? '#fee2e2' : isOnline ? '#dcfce7' : '#e5e7eb';
                const label = isInCall ? 'Im Gespräch' : isOnline ? 'Online' : p.status === 'unknown' ? 'Unbekannt' : 'Offline';
                const icon = isInCall ? '📞' : isOnline ? '🟢' : '⚫';
                return (
                  <div
                    key={p.id}
                    style={{
                      background: bg,
                      border: `1px solid ${border}`,
                      borderRadius: '10px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: dotColor,
                        flexShrink: 0,
                        boxShadow: isInCall ? '0 0 0 3px #fca5a533' : isOnline ? '0 0 0 3px #86efac33' : 'none',
                      }} />
                      <span style={{ fontWeight: 600, color: '#111827', fontSize: '1rem' }}>{p.full_name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: isInCall ? '#b91c1c' : isOnline ? '#15803d' : '#6b7280' }}>
                      <span>{icon}</span>
                      <span>{label}</span>
                    </div>
                    <code style={{ fontSize: '0.75rem', color: '#9ca3af', background: '#f3f4f6', borderRadius: '4px', padding: '0.1rem 0.35rem', alignSelf: 'flex-start' }}>{p.username}</code>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: '#f9fafb', borderRadius: '8px', fontSize: '0.8rem', color: '#6b7280', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <span><span style={{ color: '#22c55e' }}>●</span> Online — eingeloggt, erreichbar</span>
            <span><span style={{ color: '#ef4444' }}>●</span> Im Gespräch — aktiver Anruf</span>
            <span><span style={{ color: '#9ca3af' }}>●</span> Offline — nicht eingeloggt</span>
          </div>

          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '8px', fontSize: '0.82rem', color: '#1e40af' }}>
            💡 <strong>Anrufweiterleitung:</strong> Wenn ein Mitarbeiter beschäftigt ist, klingelt das Telefon automatisch bei allen anderen eingeloggten Mitarbeitern. Wenn niemand erreichbar ist, landet der Anrufer auf dem Anrufbeantworter.
          </div>
        </div>
      ) : activeTab === 'sip' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
          
          {/* SIP Users Table */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#111827' }}>Konfigurierte Nebenstellen</h2>
            
            {sipUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280', border: '2px dashed #e5e7eb', borderRadius: '8px' }}>
                <span style={{ fontSize: '2rem' }}>📭</span>
                <p style={{ margin: '0.5rem 0 0 0' }}>Keine SIP-Nutzer angelegt. Erstellen Sie rechts eine neue Nebenstelle.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#374151', fontSize: '0.85rem', fontWeight: 600 }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Mitarbeiter / Name</th>
                      <th style={{ padding: '0.75rem 1rem' }}>SIP-Benutzername</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Passwort</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Erstellt am</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sipUsers.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6', fontSize: '0.9rem', color: '#4b5563' }}>
                        <td style={{ padding: '1rem', fontWeight: 500, color: '#111827' }}>{u.full_name}</td>
                        <td style={{ padding: '1rem' }}>
                          <code style={{ background: '#f3f4f6', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>{u.username}</code>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <code style={{ background: '#f3f4f6', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                              {revealedPasswords[u.id] ? u.password : '••••••••••••'}
                            </code>
                            <button 
                              onClick={() => togglePasswordReveal(u.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                              title={revealedPasswords[u.id] ? 'Ausblenden' : 'Anzeigen'}
                            >
                              {revealedPasswords[u.id] ? '👁️' : '👁️‍🗨️'}
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>{formatDate(u.created_at)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteSipUser(u.id, u.full_name)}
                            style={{
                              background: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fee2e2',
                              borderRadius: '6px',
                              padding: '0.3rem 0.6rem',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              transition: 'all 0.15s',
                            }}
                            onMouseOver={e => {
                              e.currentTarget.style.background = '#fee2e2';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.background = '#fef2f2';
                            }}
                          >
                            🗑️ Löschen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Guide Container */}
            <div style={{ marginTop: '2rem', background: '#f9fafb', borderRadius: '8px', padding: '1.25rem', border: '1px solid #f3f4f6' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#111827' }}>💡 Einrichtungs-Anleitung für Mitarbeiter:</h3>
              <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.6 }}>
                <li>Installieren Sie die App <strong>Linphone</strong> auf Ihrem Smartphone oder PC.</li>
                <li>Wählen Sie <strong>"Assistent"</strong> → <strong>"SIP-Konto verwenden"</strong>.</li>
                <li>Tragen Sie Ihre Zugangsdaten ein:
                  <ul style={{ margin: '0.2rem 0', paddingLeft: '1.2rem' }}>
                    <li><strong>Benutzername:</strong> Ihr SIP-Benutzername (z.B. <code>fabian</code>)</li>
                    <li><strong>Domain/Server:</strong> Die IP-Adresse des Asterisk-Servers (lokal im WLAN)</li>
                    <li><strong>Passwort:</strong> Das oben angezeigte Passwort</li>
                    <li><strong>Protokoll:</strong> UDP</li>
                  </ul>
                </li>
                <li>Bei erfolgreicher Verbindung leuchtet der Status in Linphone grün (Registriert).</li>
              </ol>
            </div>
          </div>
          
          {/* Create User Form */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', color: '#111827' }}>Neue Nebenstelle</h2>
            
            <form onSubmit={handleCreateSipUser}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>Mitarbeiter Name</label>
                <input 
                  type="text" 
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  placeholder="z.B. Sabine Müller"
                  required
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>SIP-Benutzername</label>
                <input 
                  type="text" 
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="z.B. sabine"
                  required
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Nur Kleinbuchstaben und Zahlen.</span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>SIP-Passwort</label>
                <input 
                  type="text" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Sicheres Passwort"
                  required
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>

              {createError && (
                <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  ⚠️ {createError}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#1a1a2e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  transition: 'background 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.background = '#2a2a4e'}
                onMouseOut={e => e.currentTarget.style.background = '#1a1a2e'}
              >
                {creating ? 'Erstelle...' : '➕ Nebenstelle anlegen'}
              </button>
            </form>
          </div>
          
        </div>
      ) : (
        /* Voicemail List and Audio Player */
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <h2 style={{ margin: '0 0 1.25rem 0', fontSize: '1.25rem', color: '#111827' }}>Eingegangene Sprachnachrichten</h2>
          
          {voicemails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280', border: '2px dashed #e5e7eb', borderRadius: '8px' }}>
              <span style={{ fontSize: '2.5rem' }}>📼</span>
              <p style={{ margin: '0.5rem 0 0 0', fontWeight: 500 }}>Keine Sprachnachrichten vorhanden.</p>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>Wenn Anrufer keine Nebenstelle erreichen, können sie hier Nachrichten hinterlassen.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {voicemails.map(v => (
                <div 
                  key={v.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    background: '#f9fafb',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '1.75rem', background: '#e5e7eb', borderRadius: '50%', width: '3rem', height: '3rem', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center' }}>
                      📞
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: '1.05rem' }}>{v.callerId}</div>
                      <div style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                        <span>📅 {formatDate(v.timestamp)}</span>
                        <span style={{ marginLeft: '1rem' }}>⏱️ {formatDuration(v.duration)}</span>
                        <span style={{ marginLeft: '1rem' }}>💾 {formatFileSize(v.fileSize)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Inline HTML5 audio player styled nicely */}
                    <audio 
                      src={`/api/calls/voicemails/${v.id}/audio`} 
                      controls 
                      preload="none"
                      style={{ height: '32px', width: '240px' }}
                    />
                    
                    <button
                      onClick={() => handleDeleteVoicemail(v.id)}
                      style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '0.4rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      title="Sprachnachricht löschen"
                      onMouseOver={e => {
                        e.currentTarget.style.borderColor = '#fee2e2';
                        e.currentTarget.style.background = '#fef2f2';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                        e.currentTarget.style.background = '#fff';
                      }}
                    >
                      ❌
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
