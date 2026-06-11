import { useState, useEffect, useRef, useCallback } from 'react';

const API = '/api';

interface User { id: string; full_name: string; role: string; email?: string; }
interface Customer { id: string; first_name: string; last_name: string; address: string; phone_number?: string; }
interface Assignment {
  id: string; title: string; description: string; scheduled_at: string; status: string;
  customer: Customer; assigned_user_id?: string;
}
interface Timelog { id: string; assignment_id: string; start_time: string; end_time: string | null; is_signed: boolean; }
interface Report { id: string; assignment_id: string; timelog_id: string; notes: string; created_at: string; signature_id: string | null; }

type AppTab = 'auftraege' | 'bericht' | 'zeiten' | 'rechnung';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

function statusLabel(s: string) {
  return ({ pending: 'Ausstehend', in_progress: 'In Bearbeitung', completed: 'Abgeschlossen', cancelled: 'Abgebrochen' } as Record<string, string>)[s] || s;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDuration(start: string, end: string | null) {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ── Login Screen ───────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (r.status === 401 || r.status === 403) { setError('Benutzername oder Passwort falsch.'); return; }
      if (!r.ok) throw new Error('Serverfehler');
      const d = await r.json();
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      onLogin(d.user);
    } catch {
      setError('Verbindungsfehler. Bitte erneut versuchen.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f0faf9', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: 'white', borderRadius: '16px', padding: '32px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/logo.png" alt="Helferchen" style={{ height: '56px', marginBottom: '12px' }} />
          <h1 style={{ fontSize: '1.4rem', color: '#00454A', margin: 0 }}>Helferchen App</h1>
          <p style={{ color: '#6B7280', fontSize: '0.9rem', marginTop: '4px' }}>Mitarbeiter-Zugang</p>
        </div>
        {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <input
            type="text" placeholder="Benutzername" value={username}
            onChange={e => setUsername(e.target.value)} required
            style={inputStyle}
          />
          <input
            type="password" placeholder="Passwort" value={password}
            onChange={e => setPassword(e.target.value)} required
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={primaryBtnStyle}>
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Aufträge Tab ───────────────────────────────────────────────────────────────

function AuftraegeTab({ user }: { user: User }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, tRes] = await Promise.all([
        fetch(`${API}/assignments/my`, { headers: authHeaders() }),
        fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
      ]);
      if (aRes.ok) setAssignments(await aRes.json());
      if (tRes.ok) setTimelogs(await tRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (id: string, status: string) => {
    await fetch(`${API}/assignments/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
    showMsg(status === 'in_progress' ? '▶ Auftrag gestartet' : '✓ Auftrag abgeschlossen');
    load();
  };

  const startTimer = async (assignmentId: string) => {
    const r = await fetch(`${API}/timelogs/start`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignmentId }) });
    if (r.ok) { showMsg('⏱ Timer gestartet'); load(); }
    else { const d = await r.json(); showMsg('⚠ ' + (d.message || 'Fehler')); }
  };

  const stopTimer = async (timelogId: string) => {
    const r = await fetch(`${API}/timelogs/stop`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ timelog_id: timelogId }) });
    if (r.ok) { showMsg('⏹ Timer gestoppt'); load(); }
  };

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const filtered = assignments.filter(a => a.scheduled_at && a.scheduled_at.startsWith(filterDate));
  const activeTimelog = timelogs.find(t => !t.end_time);

  if (loading) return <div style={loadingStyle}>Lädt…</div>;

  return (
    <div style={tabContent}>
      {msg && <div style={toastStyle}>{msg}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <label style={{ fontSize: '0.85rem', color: '#6B7280', whiteSpace: 'nowrap' }}>Datum:</label>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...inputStyle, flex: 1, padding: '8px 10px' }} />
      </div>

      {activeTimelog && (
        <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#065F46', fontWeight: 600 }}>⏱ Timer läuft</p>
          <p style={{ margin: '4px 0 10px', color: '#047857', fontSize: '0.9rem' }}>
            {assignments.find(a => a.id === activeTimelog.assignment_id)?.title || 'Unbekannter Auftrag'} — {formatDuration(activeTimelog.start_time, null)}
          </p>
          <button style={dangerBtnStyle} onClick={() => stopTimer(activeTimelog.id)}>⏹ Timer stoppen</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '48px 0', fontSize: '0.95rem' }}>
          <p>📭 Keine Aufträge für diesen Tag.</p>
        </div>
      ) : (
        filtered.map(a => {
          const runningLog = timelogs.find(t => t.assignment_id === a.id && !t.end_time);
          return (
            <div key={a.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${a.status === 'completed' ? '#10B981' : a.status === 'in_progress' ? '#F59E0B' : '#00454A'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <strong style={{ fontSize: '1rem', flex: 1 }}>{a.title}</strong>
                <span style={{ fontSize: '0.75rem', background: a.status === 'completed' ? '#D1FAE5' : a.status === 'in_progress' ? '#FEF3C7' : '#E0F2FE', color: a.status === 'completed' ? '#065F46' : a.status === 'in_progress' ? '#92400E' : '#0369A1', padding: '2px 8px', borderRadius: '12px', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                  {statusLabel(a.status)}
                </span>
              </div>
              <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#374151' }}>⏰ {formatTime(a.scheduled_at)} Uhr</p>
              {a.customer && (
                <>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#374151' }}>👤 {a.customer.first_name} {a.customer.last_name}</p>
                  <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#374151' }}>📍 {a.customer.address}</p>
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(a.customer.address)}`} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-block', fontSize: '0.8rem', color: '#00454A', textDecoration: 'underline', marginBottom: '10px' }}>
                    In Maps öffnen ↗
                  </a>
                </>
              )}
              {a.description && <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '6px 0', padding: '8px', background: '#F9FAFB', borderRadius: '6px' }}>{a.description}</p>}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {a.status === 'pending' && <button style={primaryBtnStyle} onClick={() => handleStatus(a.id, 'in_progress')}>▶ Starten</button>}
                {a.status === 'in_progress' && !runningLog && <button style={secondaryBtnStyle} onClick={() => startTimer(a.id)}>⏱ Timer starten</button>}
                {runningLog && <button style={dangerBtnStyle} onClick={() => stopTimer(runningLog.id)}>⏹ Timer stoppen</button>}
                {a.status === 'in_progress' && <button style={successBtnStyle} onClick={() => handleStatus(a.id, 'completed')}>✓ Abschließen</button>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Signature Canvas ───────────────────────────────────────────────────────────

function SignatureCanvas({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    drawing.current = true;
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a2e';
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    setHasSignature(true);
  };

  const stopDraw = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const save = () => {
    if (!hasSignature) return;
    onSave(canvasRef.current!.toDataURL('image/png'));
  };

  return (
    <div>
      <p style={{ fontSize: '0.85rem', color: '#6B7280', marginBottom: '8px' }}>Unterschrift des Kunden:</p>
      <canvas
        ref={canvasRef} width={640} height={200}
        style={{ width: '100%', height: '140px', border: '2px dashed #D1D5DB', borderRadius: '8px', background: '#FAFAFA', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <button style={{ ...secondaryBtnStyle, fontSize: '0.8rem', padding: '6px 14px' }} onClick={clear}>✕ Löschen</button>
        <button style={{ ...primaryBtnStyle, fontSize: '0.8rem', padding: '6px 14px' }} onClick={save} disabled={!hasSignature}>
          ✓ Unterschrift übernehmen
        </button>
      </div>
    </div>
  );
}

// ── Bericht Tab ────────────────────────────────────────────────────────────────

function BerichtTab({ user }: { user: User }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState('');
  const [selectedTimelog, setSelectedTimelog] = useState('');
  const [notes, setNotes] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [createdReport, setCreatedReport] = useState<Report | null>(null);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    const [aRes, tRes, rRes] = await Promise.all([
      fetch(`${API}/assignments/my`, { headers: authHeaders() }),
      fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
      fetch(`${API}/reports/my`, { headers: authHeaders() }),
    ]);
    if (aRes.ok) setAssignments(await aRes.json());
    if (tRes.ok) setTimelogs(await tRes.json());
    if (rRes.ok) setReports(await rRes.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  const completedAssignments = assignments.filter(a => a.status === 'completed' || a.status === 'in_progress');
  const availableTimelogs = timelogs.filter(t => t.assignment_id === selectedAssignment && t.end_time);
  const reportedTimelogIds = reports.map(r => r.timelog_id);
  const unreportedTimelogs = availableTimelogs.filter(t => !reportedTimelogIds.includes(t.id));

  const handleSaveReport = async () => {
    if (!selectedAssignment || !selectedTimelog || !notes.trim()) {
      showMsg('⚠ Bitte Auftrag, Zeiteintrag und Bericht ausfüllen.'); return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API}/reports`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ assignment_id: selectedAssignment, timelog_id: selectedTimelog, notes }),
      });
      if (!r.ok) { const d = await r.json(); showMsg('❌ ' + (d.message || 'Fehler beim Speichern')); return; }
      const report = await r.json();
      setCreatedReport(report);
      showMsg('✅ Bericht gespeichert!');
      load();
    } finally { setSaving(false); }
  };

  const handleSaveSignature = async () => {
    if (!createdReport) { showMsg('⚠ Bitte zuerst Bericht speichern.'); return; }
    if (!signatureData) { showMsg('⚠ Bitte Unterschrift zeichnen.'); return; }
    if (!signerName.trim()) { showMsg('⚠ Bitte Name des Unterzeichners eingeben.'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API}/signatures`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ report_id: createdReport.id, image_data: signatureData, signer_name: signerName }),
      });
      if (!r.ok) { const d = await r.json(); showMsg('❌ ' + (d.message || 'Fehler')); return; }
      showMsg('✅ Unterschrift gespeichert!');
      setSignatureData('');
      load();
    } finally { setSaving(false); }
  };

  const downloadPdf = (reportId: string) => {
    window.open(`${API}/pdf/${reportId}`, '_blank');
  };

  return (
    <div style={tabContent}>
      {msg && <div style={toastStyle}>{msg}</div>}

      <section style={cardStyle}>
        <h3 style={sectionTitle}>Neuen Bericht erstellen</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Auftrag wählen:</label>
            <select value={selectedAssignment} onChange={e => { setSelectedAssignment(e.target.value); setSelectedTimelog(''); setCreatedReport(null); }} style={inputStyle}>
              <option value="">— Auftrag auswählen —</option>
              {completedAssignments.map(a => (
                <option key={a.id} value={a.id}>{a.title} ({a.customer?.first_name} {a.customer?.last_name})</option>
              ))}
            </select>
          </div>

          {selectedAssignment && (
            <div>
              <label style={labelStyle}>Zeiteintrag wählen:</label>
              {unreportedTimelogs.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#9CA3AF' }}>Keine abgeschlossenen Zeiteinträge ohne Bericht.</p>
              ) : (
                <select value={selectedTimelog} onChange={e => setSelectedTimelog(e.target.value)} style={inputStyle}>
                  <option value="">— Zeiteintrag auswählen —</option>
                  {unreportedTimelogs.map(t => (
                    <option key={t.id} value={t.id}>
                      {formatDate(t.start_time)} {formatTime(t.start_time)} – {t.end_time ? formatTime(t.end_time) : 'laufend'} ({formatDuration(t.start_time, t.end_time)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label style={labelStyle}>Bericht / Notizen:</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)} rows={4}
              placeholder="Beschreibung der erledigten Arbeiten…"
              style={{ ...inputStyle, resize: 'vertical', minHeight: '100px', fontFamily: 'inherit' }}
            />
          </div>

          <button style={primaryBtnStyle} onClick={handleSaveReport} disabled={saving}>
            {saving ? 'Speichern…' : '💾 Bericht speichern'}
          </button>
        </div>
      </section>

      {createdReport && (
        <section style={{ ...cardStyle, border: '1px solid #6EE7B7' }}>
          <h3 style={sectionTitle}>Unterschrift einholen</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Name des Unterzeichners (Kunde):</label>
              <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Vor- und Nachname" style={inputStyle} />
            </div>
            <SignatureCanvas onSave={data => setSignatureData(data)} />
            {signatureData && (
              <div>
                <p style={{ fontSize: '0.8rem', color: '#6B7280', margin: '0 0 4px' }}>Vorschau:</p>
                <img src={signatureData} alt="Unterschrift" style={{ maxWidth: '200px', border: '1px solid #E5E7EB', borderRadius: '6px' }} />
              </div>
            )}
            <button style={successBtnStyle} onClick={handleSaveSignature} disabled={saving || !signatureData}>
              {saving ? 'Speichern…' : '✍ Unterschrift speichern'}
            </button>
            <button style={secondaryBtnStyle} onClick={() => downloadPdf(createdReport.id)}>
              📄 PDF herunterladen
            </button>
          </div>
        </section>
      )}

      {reports.length > 0 && (
        <section style={cardStyle}>
          <h3 style={sectionTitle}>Meine Berichte</h3>
          {reports.slice(0, 5).map(r => {
            const a = assignments.find(x => x.id === r.assignment_id);
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{a?.title || 'Unbekannt'}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280' }}>{formatDate(r.created_at)} {r.signature_id ? '✍ Unterschrift' : ''}</p>
                </div>
                <button style={{ ...secondaryBtnStyle, fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => downloadPdf(r.id)}>
                  📄 PDF
                </button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

// ── Zeiten Tab ─────────────────────────────────────────────────────────────────

function ZeitenTab({ user }: { user: User }) {
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, aRes] = await Promise.all([
        fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
        fetch(`${API}/assignments/my`, { headers: authHeaders() }),
      ]);
      if (tRes.ok) setTimelogs(await tRes.json());
      if (aRes.ok) setAssignments(await aRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const stopTimer = async (timelogId: string) => {
    const r = await fetch(`${API}/timelogs/stop`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ timelog_id: timelogId }) });
    if (r.ok) { showMsg('⏹ Timer gestoppt'); load(); }
  };

  const startTimer = async (assignmentId: string) => {
    const r = await fetch(`${API}/timelogs/start`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignmentId }) });
    if (r.ok) { showMsg('⏱ Timer gestartet'); load(); }
    else { const d = await r.json(); showMsg('⚠ ' + (d.message || 'Fehler')); }
  };

  const running = timelogs.filter(t => !t.end_time);
  const done = timelogs.filter(t => t.end_time).slice(0, 20);
  const availableForTimer = assignments.filter(a => a.status === 'in_progress' && !running.find(t => t.assignment_id === a.id));

  if (loading) return <div style={loadingStyle}>Lädt…</div>;

  return (
    <div style={tabContent}>
      {msg && <div style={toastStyle}>{msg}</div>}

      {running.length > 0 && (
        <section style={{ ...cardStyle, background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
          <h3 style={{ ...sectionTitle, color: '#065F46' }}>⏱ Laufende Timer</h3>
          {running.map(t => {
            const a = assignments.find(x => x.id === t.assignment_id);
            return (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>{a?.title || 'Auftrag'}</p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#047857' }}>{formatDuration(t.start_time, null)} ⏳</p>
                </div>
                <button style={dangerBtnStyle} onClick={() => stopTimer(t.id)}>⏹ Stop</button>
              </div>
            );
          })}
        </section>
      )}

      {availableForTimer.length > 0 && (
        <section style={cardStyle}>
          <h3 style={sectionTitle}>Timer starten</h3>
          {availableForTimer.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>{a.title}</p>
              <button style={primaryBtnStyle} onClick={() => startTimer(a.id)}>⏱ Starten</button>
            </div>
          ))}
        </section>
      )}

      <section style={cardStyle}>
        <h3 style={sectionTitle}>Zeithistorie</h3>
        {done.length === 0 ? (
          <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>Noch keine abgeschlossenen Zeiteinträge.</p>
        ) : (
          done.map(t => {
            const a = assignments.find(x => x.id === t.assignment_id);
            return (
              <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{a?.title || '—'}</p>
                <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#6B7280' }}>
                  {formatDate(t.start_time)} {formatTime(t.start_time)} – {t.end_time ? formatTime(t.end_time) : '?'} ({formatDuration(t.start_time, t.end_time)})
                  {t.is_signed ? ' ✍' : ''}
                </p>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

// ── Rechnung Tab ───────────────────────────────────────────────────────────────

function RechnungTab({ user }: { user: User }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailModal, setEmailModal] = useState<{ reportId: string } | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  useEffect(() => {
    (async () => {
      const [rRes, aRes] = await Promise.all([
        fetch(`${API}/reports/my`, { headers: authHeaders() }),
        fetch(`${API}/assignments/my`, { headers: authHeaders() }),
      ]);
      if (rRes.ok) setReports(await rRes.json());
      if (aRes.ok) setAssignments(await aRes.json());
      setLoading(false);
    })();
  }, []);

  const sendEmail = async () => {
    if (!emailModal || !emailAddress) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/pdf/${emailModal.reportId}/email`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ to: emailAddress }),
      });
      if (r.ok) { showMsg('✅ PDF per E-Mail gesendet!'); setEmailModal(null); setEmailAddress(''); }
      else { const d = await r.json(); showMsg('❌ ' + (d.message || 'Fehler beim Senden')); }
    } finally { setSending(false); }
  };

  if (loading) return <div style={loadingStyle}>Lädt…</div>;

  return (
    <div style={tabContent}>
      {msg && <div style={toastStyle}>{msg}</div>}

      {emailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '340px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>📧 PDF per E-Mail senden</h3>
            <input type="email" value={emailAddress} onChange={e => setEmailAddress(e.target.value)} placeholder="E-Mail-Adresse" style={inputStyle} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button style={secondaryBtnStyle} onClick={() => setEmailModal(null)}>Abbrechen</button>
              <button style={primaryBtnStyle} onClick={sendEmail} disabled={sending || !emailAddress}>
                {sending ? 'Senden…' : 'Senden'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section style={cardStyle}>
        <h3 style={sectionTitle}>Meine Berichte & PDFs</h3>
        {reports.length === 0 ? (
          <p style={{ color: '#9CA3AF', fontSize: '0.9rem' }}>Noch keine Berichte vorhanden. Erstelle im Bericht-Tab einen Bericht.</p>
        ) : (
          reports.map(r => {
            const a = assignments.find(x => x.id === r.assignment_id);
            return (
              <div key={r.id} style={{ padding: '14px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem' }}>{a?.title || 'Unbekannter Auftrag'}</p>
                    <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#6B7280' }}>
                      {a?.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '—'}
                    </p>
                    <p style={{ margin: '2px 0', fontSize: '0.8rem', color: '#6B7280' }}>
                      {formatDate(r.created_at)} {r.signature_id ? '· ✍ Unterschrift vorhanden' : '· Keine Unterschrift'}
                    </p>
                    {r.notes && <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#374151', background: '#F9FAFB', padding: '6px 8px', borderRadius: '6px' }}>{r.notes.slice(0, 80)}{r.notes.length > 80 ? '…' : ''}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button style={{ ...secondaryBtnStyle, fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={() => window.open(`${API}/pdf/${r.id}`, '_blank')}>
                    📄 PDF
                  </button>
                  <button style={{ ...secondaryBtnStyle, fontSize: '0.8rem', padding: '6px 12px' }}
                    onClick={() => { setEmailModal({ reportId: r.id }); setEmailAddress(a?.customer?.phone_number || ''); }}>
                    📧 E-Mail
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

function MobileApp() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<AppTab>('auftraege');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        const u = JSON.parse(stored) as User;
        fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => { if (r.ok) return r.json(); throw new Error('Unauthorized'); })
          .then(u => setUser(u))
          .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); })
          .finally(() => setChecking(false));
      } catch { setChecking(false); }
    } else { setChecking(false); }
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (checking) return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0faf9' }}><p style={{ color: '#00454A' }}>Laden…</p></div>;

  if (!user) return <LoginScreen onLogin={u => setUser(u)} />;

  const navItems: { id: AppTab; label: string; icon: string }[] = [
    { id: 'auftraege', label: 'Aufträge', icon: '📅' },
    { id: 'bericht', label: 'Bericht', icon: '✍' },
    { id: 'zeiten', label: 'Zeiten', icon: '⏱' },
    { id: 'rechnung', label: 'Rechnung', icon: '📄' },
  ];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#F9FAFB', maxWidth: '520px', margin: '0 auto', position: 'relative' }}>
      <header style={{ background: '#00454A', color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="" style={{ height: '28px', filter: 'brightness(0) invert(1)' }} />
          <div>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Helferchen App</p>
            <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>{user.full_name}</p>
          </div>
        </div>
        <button onClick={logout} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
          Abmelden
        </button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
        {tab === 'auftraege' && <AuftraegeTab user={user} />}
        {tab === 'bericht' && <BerichtTab user={user} />}
        {tab === 'zeiten' && <ZeitenTab user={user} />}
        {tab === 'rechnung' && <RechnungTab user={user} />}
      </main>

      <nav style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '520px', background: 'white', borderTop: '1px solid #E5E7EB', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '10px 4px', border: 'none', background: 'transparent', cursor: 'pointer',
              color: tab === item.id ? '#00454A' : '#9CA3AF',
              borderTop: tab === item.id ? '2px solid #00454A' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
            <span style={{ fontSize: '0.7rem', marginTop: '2px', fontWeight: tab === item.id ? 600 : 400 }}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px',
  fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px', background: '#00454A', color: 'white', border: 'none',
  borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px', background: 'white', color: '#374151', border: '1px solid #D1D5DB',
  borderRadius: '8px', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
};

const successBtnStyle: React.CSSProperties = {
  padding: '10px 18px', background: '#10B981', color: 'white', border: 'none',
  borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

const dangerBtnStyle: React.CSSProperties = {
  padding: '10px 18px', background: '#EF4444', color: 'white', border: 'none',
  borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};

const tabContent: React.CSSProperties = { padding: '16px' };

const cardStyle: React.CSSProperties = {
  background: 'white', borderRadius: '12px', padding: '16px', marginBottom: '14px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#111827',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 500,
};

const loadingStyle: React.CSSProperties = {
  padding: '48px', textAlign: 'center', color: '#6B7280',
};

const toastStyle: React.CSSProperties = {
  position: 'sticky', top: 0, background: '#00454A', color: 'white', padding: '10px 16px',
  textAlign: 'center', fontSize: '0.9rem', borderRadius: '8px', margin: '0 0 12px', zIndex: 50,
};

export default MobileApp;
