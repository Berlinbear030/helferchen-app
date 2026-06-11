import { useState, useEffect, useRef, useCallback } from 'react';

const API = '/api';

interface User { id: string; full_name: string; role: string; email?: string; }
interface Customer { id: string; first_name: string; last_name: string; address: string; phone_number?: string; email?: string; }
interface Assignment { id: string; title: string; description: string; scheduled_at: string; status: string; customer: Customer; assigned_user_id?: string; hourly_rate?: number; }
interface Timelog { id: string; assignment_id: string; start_time: string; end_time: string | null; is_signed: boolean; }
interface Report { id: string; assignment_id: string; timelog_id: string; notes: string; created_at: string; signature_id: string | null; }

// ── Flow state carried through all steps ──────────────────────────────────────

interface FlowState {
  assignment: Assignment;
  timelog: Timelog | null;
  notes: string;
  reportId: string | null;
  signatureData: string;
  signerName: string;
  paymentMethod: 'bar' | null;
  savedWithoutPayment: boolean;
}

type Screen = 'list' | 'detail' | 'timer' | 'bericht' | 'zusammenfassung' | 'unterschrift' | 'zahlung' | 'abschluss';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

function pad(n: number) { return n < 10 ? '0' + n : String(n); }

function formatClock(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDurationMs(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function calcMinutes(start: string, end: string | null): number {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  return Math.ceil(ms / 60000);
}

function calcPrice(minutes: number, rate: number): number {
  return Math.round((minutes / 60) * rate * 100) / 100;
}

function euroFmt(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) });
      if (!r.ok) { setErr('Benutzername oder Passwort falsch.'); return; }
      const d = await r.json();
      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));
      onLogin(d.user);
    } catch { setErr('Verbindungsfehler.'); } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#00454A', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src="/logo.png" alt="Helferchen" style={{ height: '60px', filter: 'brightness(0) invert(1)', marginBottom: '16px' }} />
          <h1 style={{ color: 'white', fontSize: '1.6rem', margin: 0, fontWeight: 700 }}>Helferchen</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', margin: '8px 0 0', fontSize: '0.95rem' }}>Mitarbeiter-App</p>
        </div>
        <div style={{ background: 'white', borderRadius: '20px', padding: '28px 24px' }}>
          {err && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px', fontSize: '0.9rem' }}>{err}</div>}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input type="text" placeholder="Benutzername" value={user} onChange={e => setUser(e.target.value)} required style={iStyle} />
            <input type="password" placeholder="Passwort" value={pass} onChange={e => setPass(e.target.value)} required style={iStyle} />
            <button type="submit" disabled={busy} style={{ ...btnPrimary, marginTop: '4px', padding: '14px', fontSize: '1rem', borderRadius: '12px' }}>
              {busy ? 'Anmelden…' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Assignment List ────────────────────────────────────────────────────────────

function ListScreen({ user, onSelect }: { user: User; onSelect: (a: Assignment) => void }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, tRes] = await Promise.all([
      fetch(`${API}/assignments/my`, { headers: authHeaders() }),
      fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
    ]);
    if (aRes.ok) setAssignments(await aRes.json());
    if (tRes.ok) setTimelogs(await tRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = assignments.filter(a => {
    if (!filterDate) return true;
    return a.scheduled_at && a.scheduled_at.startsWith(filterDate);
  });

  const today = new Date().toISOString().slice(0, 10);
  const isToday = filterDate === today;

  const statusColor = (s: string) => ({ pending: '#6B7280', in_progress: '#F59E0B', completed: '#10B981' })[s] || '#6B7280';
  const statusLabel = (s: string) => ({ pending: 'Ausstehend', in_progress: 'In Bearbeitung', completed: 'Abgeschlossen' })[s] || s;

  return (
    <div style={screenWrap}>
      <div style={{ padding: '16px 16px 8px', background: 'white', borderBottom: '1px solid #F3F4F6' }}>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...iStyle, fontSize: '0.9rem', padding: '8px 12px' }} />
        {!isToday && <button onClick={() => setFilterDate(today)} style={{ display: 'block', width: '100%', marginTop: '8px', padding: '6px', background: 'transparent', border: 'none', color: '#00454A', fontSize: '0.85rem', cursor: 'pointer' }}>← Heute</button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>Lädt…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 12px' }}>📭</p>
            <p style={{ color: '#9CA3AF', fontSize: '0.95rem' }}>Keine Aufträge für {isToday ? 'heute' : 'diesen Tag'}.</p>
          </div>
        ) : (
          filtered.map(a => {
            const runningLog = timelogs.find(t => t.assignment_id === a.id && !t.end_time);
            return (
              <button key={a.id} onClick={() => onSelect(a)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'white', border: 'none', borderRadius: '16px', padding: '18px', marginBottom: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: statusColor(a.status), borderRadius: '16px 0 0 16px' }} />
                <div style={{ marginLeft: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '1.05rem', color: '#111827', flex: 1, paddingRight: '8px' }}>{a.title}</strong>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor(a.status), whiteSpace: 'nowrap' }}>{statusLabel(a.status)}</span>
                  </div>
                  <p style={{ margin: '3px 0', fontSize: '0.85rem', color: '#6B7280' }}>⏰ {formatClock(a.scheduled_at)}</p>
                  {a.customer && <p style={{ margin: '3px 0', fontSize: '0.85rem', color: '#374151' }}>👤 {a.customer.first_name} {a.customer.last_name}</p>}
                  {a.customer?.address && <p style={{ margin: '3px 0', fontSize: '0.85rem', color: '#6B7280' }}>📍 {a.customer.address}</p>}
                  {runningLog && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#F59E0B', fontWeight: 600 }}>⏱ Timer läuft</p>}
                </div>
                <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#D1D5DB', fontSize: '1.2rem' }}>›</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Assignment Detail + Timer Start ───────────────────────────────────────────

function DetailScreen({ flow, onBack, onStartTimer, onContinue }: {
  flow: FlowState;
  onBack: () => void;
  onStartTimer: (timelog: Timelog) => void;
  onContinue: (timelog: Timelog) => void;
}) {
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { assignment } = flow;

  const load = useCallback(async () => {
    const r = await fetch(`${API}/timelogs/my`, { headers: authHeaders() });
    if (r.ok) setTimelogs(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const assignmentTimelogs = timelogs.filter(t => t.assignment_id === assignment.id);
  const running = assignmentTimelogs.find(t => !t.end_time);
  const stopped = assignmentTimelogs.filter(t => t.end_time);

  const startTimer = async () => {
    setBusy(true); setErr('');
    const r = await fetch(`${API}/timelogs/start`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignment.id }) });
    if (r.ok) {
      const timelog = await r.json();
      if (assignment.status === 'pending') {
        await fetch(`${API}/assignments/${assignment.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'in_progress' }) });
      }
      onStartTimer(timelog);
    } else { const d = await r.json(); setErr(d.message || 'Fehler beim Starten.'); }
    setBusy(false);
  };

  const continueWithTimelog = (t: Timelog) => {
    if (!t.end_time) { onContinue(t); } // resume running timer
  };

  return (
    <div style={screenWrap}>
      <div style={headerBar}>
        <button onClick={onBack} style={backBtn}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{assignment.title}</span>
        <span style={{ width: '40px' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {err && <div style={errBox}>{err}</div>}
        <div style={card}>
          <h3 style={cardTitle}>Auftrag</h3>
          <p style={detail}><span style={detailLabel}>Service</span>{assignment.title}</p>
          {assignment.description && <p style={detail}><span style={detailLabel}>Beschreibung</span>{assignment.description}</p>}
          <p style={detail}><span style={detailLabel}>Termin</span>{formatDate(assignment.scheduled_at)}, {formatClock(assignment.scheduled_at)}</p>
          <p style={detail}><span style={detailLabel}>Stundensatz</span>{euroFmt(assignment.hourly_rate ?? 65)}/Std.</p>
        </div>

        {assignment.customer && (
          <div style={card}>
            <h3 style={cardTitle}>Kunde</h3>
            <p style={detail}><span style={detailLabel}>Name</span>{assignment.customer.first_name} {assignment.customer.last_name}</p>
            <p style={detail}><span style={detailLabel}>Adresse</span>{assignment.customer.address}</p>
            {assignment.customer.phone_number && <p style={detail}><span style={detailLabel}>Telefon</span>{assignment.customer.phone_number}</p>}
            <a href={`https://maps.google.com/?q=${encodeURIComponent(assignment.customer.address)}`} target="_blank" rel="noreferrer"
              style={{ display: 'inline-block', marginTop: '8px', color: '#00454A', fontSize: '0.85rem', fontWeight: 600 }}>
              📍 In Maps öffnen ↗
            </a>
          </div>
        )}

        {!loading && stopped.length > 0 && (
          <div style={card}>
            <h3 style={cardTitle}>Vorherige Zeiteinträge</h3>
            {stopped.map(t => (
              <p key={t.id} style={{ margin: '4px 0', fontSize: '0.85rem', color: '#6B7280' }}>
                {formatClock(t.start_time)} – {t.end_time ? formatClock(t.end_time) : '?'} ({calcMinutes(t.start_time, t.end_time)} Min)
              </p>
            ))}
          </div>
        )}

        {running && (
          <div style={{ ...card, background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
            <p style={{ margin: 0, color: '#065F46', fontWeight: 600 }}>⏱ Timer läuft gerade</p>
            <button style={{ ...btnPrimary, marginTop: '12px', width: '100%' }} onClick={() => continueWithTimelog(running)}>
              Zum laufenden Timer →
            </button>
          </div>
        )}
      </div>

      {!running && (
        <div style={bottomBar}>
          <button style={{ ...btnPrimary, width: '100%', padding: '16px', fontSize: '1.05rem', borderRadius: '14px' }} onClick={startTimer} disabled={busy}>
            {busy ? 'Startet…' : '⏱ Timer starten'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Timer Running Screen ───────────────────────────────────────────────────────

function TimerScreen({ flow, onBack, onStop }: {
  flow: FlowState;
  onBack: () => void;
  onStop: (timelog: Timelog) => void;
}) {
  const { assignment, timelog } = flow;
  const [elapsed, setElapsed] = useState(0);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!timelog) return;
    const tick = () => setElapsed(Date.now() - new Date(timelog.start_time).getTime());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [timelog]);

  const stop = async () => {
    if (!timelog) return;
    setStopping(true);
    const r = await fetch(`${API}/timelogs/stop`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ timelog_id: timelog.id }) });
    if (r.ok) {
      const stopped = await r.json();
      onStop(stopped);
    }
    setStopping(false);
  };

  const h = Math.floor(elapsed / 3600000);
  const m = Math.floor((elapsed % 3600000) / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);

  return (
    <div style={{ ...screenWrap, background: '#00454A' }}>
      <div style={{ ...headerBar, background: '#00454A', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={onBack} style={{ ...backBtn, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)' }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'white' }}>Timer</span>
        <span style={{ width: '40px' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', margin: '0 0 8px', textAlign: 'center' }}>{assignment.title}</p>
        {assignment.customer && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: '0 0 48px', textAlign: 'center' }}>👤 {assignment.customer.first_name} {assignment.customer.last_name}</p>}

        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '24px', padding: '40px 48px', textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '4px' }}>
            {h > 0 && <>
              <span style={{ fontSize: '4rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pad(h)}</span>
              <span style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.2, padding: '0 2px' }}>:</span>
            </>}
            <span style={{ fontSize: '4rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pad(m)}</span>
            <span style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.2, padding: '0 2px' }}>:</span>
            <span style={{ fontSize: '4rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{pad(s)}</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', margin: '16px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {timelog ? `Gestartet ${formatClock(timelog.start_time)}` : ''}
          </p>
        </div>
      </div>

      <div style={{ padding: '16px 24px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <button style={{ width: '100%', padding: '16px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '14px', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer' }} onClick={stop} disabled={stopping}>
          {stopping ? 'Stoppt…' : '⏹ Timer stoppen'}
        </button>
      </div>
    </div>
  );
}

// ── Bericht Screen ─────────────────────────────────────────────────────────────

function BerichtScreen({ flow, onBack, onNext }: {
  flow: FlowState;
  onBack: () => void;
  onNext: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(flow.notes);
  const { assignment, timelog } = flow;

  const minutes = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const rate = assignment.hourly_rate ?? 65;
  const price = calcPrice(minutes, rate);

  return (
    <div style={screenWrap}>
      <div style={headerBar}>
        <button onClick={onBack} style={backBtn}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Bericht schreiben</span>
        <span style={{ width: '40px' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ ...card, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#065F46', fontSize: '1rem' }}>{assignment.customer?.first_name} {assignment.customer?.last_name}</p>
              <p style={{ margin: '4px 0 0', color: '#047857', fontSize: '0.85rem' }}>{assignment.customer?.address}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {timelog && <p style={{ margin: 0, color: '#047857', fontWeight: 700, fontSize: '1.1rem' }}>{minutes} Min</p>}
              {timelog && <p style={{ margin: '2px 0 0', color: '#059669', fontSize: '0.8rem' }}>{formatClock(timelog.start_time)} – {timelog.end_time ? formatClock(timelog.end_time) : '?'}</p>}
            </div>
          </div>
        </div>

        <div style={card}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: '10px', color: '#374151' }}>Was wurde erledigt?</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Beschreibung der erledigten Arbeiten, besondere Vorkommnisse, verwendete Materialien…"
            rows={6}
            style={{ ...iStyle, resize: 'vertical', minHeight: '140px', fontFamily: 'inherit', lineHeight: 1.5 }}
            autoFocus
          />
        </div>

        <div style={{ ...card, background: '#F9FAFB' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#6B7280', fontSize: '0.9rem' }}>Voraussichtliche Kosten</span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#111827' }}>{euroFmt(price)}</span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>{minutes} Min × {euroFmt(rate)}/Std.</p>
        </div>
      </div>

      <div style={bottomBar}>
        <button
          style={{ ...btnPrimary, width: '100%', padding: '16px', fontSize: '1.05rem', borderRadius: '14px', opacity: notes.trim() ? 1 : 0.5 }}
          onClick={() => { if (notes.trim()) onNext(notes); }}
          disabled={!notes.trim()}
        >
          Weiter zur Zusammenfassung →
        </button>
      </div>
    </div>
  );
}

// ── Zusammenfassung + Unterschrift ────────────────────────────────────────────

function SignatureCanvas({ onSave }: { onSave: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [has, setHas] = useState(false);

  const pos = (e: React.TouchEvent | React.MouseEvent, c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    return { x: ((e as React.MouseEvent).clientX - r.left) * sx, y: ((e as React.MouseEvent).clientY - r.top) * sy };
  };

  const start = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const c = ref.current!; const ctx = c.getContext('2d')!;
    const p = pos(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    drawing.current = true;
  };
  const move = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const c = ref.current!; const ctx = c.getContext('2d')!;
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827';
    const p = pos(e, c); ctx.lineTo(p.x, p.y); ctx.stroke();
    setHas(true);
  };
  const stop = () => { drawing.current = false; };

  const clear = () => { ref.current!.getContext('2d')!.clearRect(0, 0, 640, 200); setHas(false); };
  const save = () => { if (has) onSave(ref.current!.toDataURL('image/png')); };

  return (
    <div>
      <canvas ref={ref} width={640} height={200}
        style={{ width: '100%', height: '130px', border: '2px dashed #D1D5DB', borderRadius: '12px', background: 'white', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button style={{ ...btnOutline, flex: 1, padding: '10px' }} onClick={clear}>✕ Löschen</button>
        <button style={{ ...btnPrimary, flex: 2, padding: '10px' }} onClick={save} disabled={!has}>✓ Unterschrift bestätigen</button>
      </div>
    </div>
  );
}

function ZusammenfassungScreen({ flow, onBack, onSign }: {
  flow: FlowState;
  onBack: () => void;
  onSign: (signerName: string, sigData: string, reportId: string) => void;
}) {
  const { assignment, timelog, notes } = flow;
  const [signerName, setSignerName] = useState(assignment.customer ? `${assignment.customer.first_name} ${assignment.customer.last_name}` : '');
  const [sigData, setSigData] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [reportId, setReportId] = useState(flow.reportId);

  const minutes = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const rate = assignment.hourly_rate ?? 65;
  const price = calcPrice(minutes, rate);

  useEffect(() => {
    if (reportId || !timelog?.end_time) return;
    (async () => {
      const r = await fetch(`${API}/reports`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignment.id, timelog_id: timelog.id, notes }) });
      if (r.ok) { const d = await r.json(); setReportId(d.id); }
    })();
  }, []);

  const handleSign = async () => {
    if (!sigData || !signerName.trim() || !reportId) { setErr('Bitte Name und Unterschrift eingeben.'); return; }
    setSaving(true); setErr('');
    const r = await fetch(`${API}/signatures`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ report_id: reportId, image_data: sigData, signer_name: signerName }) });
    if (r.ok) { onSign(signerName, sigData, reportId); }
    else { const d = await r.json(); setErr(d.message || 'Fehler beim Speichern.'); }
    setSaving(false);
  };

  return (
    <div style={screenWrap}>
      <div style={headerBar}>
        <button onClick={onBack} style={backBtn}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Zusammenfassung</span>
        <span style={{ width: '40px' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {err && <div style={errBox}>{err}</div>}

        <div style={{ ...card, border: '2px solid #00454A' }}>
          <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: '#00454A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Helferchen Arbeitsnachweis</p>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: '#111827' }}>{assignment.title}</h2>

          <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '14px', marginBottom: '14px' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 600, color: '#374151' }}>{assignment.customer?.first_name} {assignment.customer?.last_name}</p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#6B7280' }}>{assignment.customer?.address}</p>
          </div>

          {timelog && (
            <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '14px', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#6B7280' }}>Arbeitszeit</p>
              <p style={{ margin: 0, fontWeight: 600, color: '#111827', fontSize: '1rem' }}>
                {formatClock(timelog.start_time)} – {timelog.end_time ? formatClock(timelog.end_time) : '?'} ({minutes} Min)
              </p>
            </div>
          )}

          {notes && (
            <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '14px', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#6B7280' }}>Bericht</p>
              <p style={{ margin: 0, color: '#374151', fontSize: '0.9rem', lineHeight: 1.5 }}>{notes}</p>
            </div>
          )}

          <div style={{ borderTop: '2px solid #111827', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>Gesamtkosten</span>
            <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#00454A' }}>{euroFmt(price)}</span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9CA3AF', textAlign: 'right' }}>{minutes} Min × {euroFmt(rate)}/Std.</p>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Unterschrift des Kunden</h3>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 500 }}>Name des Unterzeichners</label>
            <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)} style={iStyle} />
          </div>
          <SignatureCanvas onSave={d => setSigData(d)} />
          {sigData && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: '0 0 6px' }}>Unterschrift gespeichert:</p>
              <img src={sigData} alt="Unterschrift" style={{ maxWidth: '160px', border: '1px solid #E5E7EB', borderRadius: '8px' }} />
            </div>
          )}
        </div>
      </div>

      <div style={bottomBar}>
        <button style={{ ...btnPrimary, width: '100%', padding: '16px', fontSize: '1.05rem', borderRadius: '14px', opacity: sigData && signerName.trim() ? 1 : 0.5 }}
          onClick={handleSign} disabled={saving || !sigData || !signerName.trim()}>
          {saving ? 'Speichert…' : 'Weiter zur Zahlung →'}
        </button>
      </div>
    </div>
  );
}

// ── Zahlung Screen ─────────────────────────────────────────────────────────────

function ZahlungScreen({ flow, onBack, onDone }: {
  flow: FlowState;
  onBack: () => void;
  onDone: (method: 'bar' | 'saved') => void;
}) {
  const { assignment, timelog } = flow;
  const minutes = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const rate = assignment.hourly_rate ?? 65;
  const price = calcPrice(minutes, rate);
  const [busy, setBusy] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);

  const downloadPdf = () => {
    if (flow.reportId) window.open(`${API}/pdf/${flow.reportId}`, '_blank');
    setDownloadDone(true);
  };

  const sendEmail = async () => {
    const email = assignment.customer?.email;
    if (!email && !flow.reportId) return;
    const addr = email || prompt('E-Mail-Adresse des Kunden:');
    if (!addr) return;
    setBusy(true);
    await fetch(`${API}/pdf/${flow.reportId}/email`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ to: addr }) });
    setBusy(false);
    alert('✅ PDF per E-Mail gesendet!');
  };

  return (
    <div style={screenWrap}>
      <div style={headerBar}>
        <button onClick={onBack} style={backBtn}>‹</button>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Zahlung</span>
        <span style={{ width: '40px' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
          <p style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>💶</p>
          <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0 0 4px' }}>Offener Betrag</p>
          <p style={{ fontSize: '2.2rem', fontWeight: 800, color: '#111827', margin: 0 }}>{euroFmt(price)}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <button style={{ ...btnPrimary, padding: '20px', fontSize: '1.1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            onClick={() => onDone('bar')}>
            <span style={{ fontSize: '1.5rem' }}>💵</span>
            <span>Bar bezahlt</span>
          </button>

          <button disabled style={{ padding: '20px', fontSize: '1.1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '2px solid #E5E7EB', background: '#F9FAFB', color: '#9CA3AF', cursor: 'not-allowed' }}>
            <span style={{ fontSize: '1.5rem' }}>💳</span>
            <span>Kartenzahlung (demnächst)</span>
          </button>

          <button style={{ ...btnOutline, padding: '16px', fontSize: '0.95rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => onDone('saved')}>
            <span>💾</span>
            <span>Zwischenspeichern (Kunde zahlt später)</span>
          </button>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Quittung senden</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{ ...btnOutline, flex: 1, padding: '12px', fontSize: '0.85rem' }} onClick={downloadPdf}>
              📄 PDF herunterladen
            </button>
            <button style={{ ...btnOutline, flex: 1, padding: '12px', fontSize: '0.85rem' }} onClick={sendEmail} disabled={busy}>
              {busy ? '…' : '📧 Per E-Mail'}
            </button>
          </div>
          {downloadDone && <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#10B981', textAlign: 'center' }}>✓ PDF geöffnet</p>}
        </div>
      </div>
    </div>
  );
}

// ── Abschluss Screen ───────────────────────────────────────────────────────────

function AbschlussScreen({ flow, onNewJob }: { flow: FlowState; onNewJob: () => void }) {
  const { assignment, timelog } = flow;
  const minutes = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const price = calcPrice(minutes, assignment.hourly_rate ?? 65);

  return (
    <div style={{ ...screenWrap, alignItems: 'center', justifyContent: 'center', background: '#00454A' }}>
      <div style={{ textAlign: 'center', padding: '40px 24px', maxWidth: '360px' }}>
        <div style={{ fontSize: '4rem', margin: '0 0 24px' }}>✅</div>
        <h2 style={{ color: 'white', fontSize: '1.6rem', margin: '0 0 12px' }}>Auftrag abgeschlossen!</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 8px' }}>{assignment.title}</p>
        <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 32px', fontSize: '0.9rem' }}>
          {flow.savedWithoutPayment ? '💾 Auftrag gespeichert — Zahlung ausstehend' : `💵 Bar bezahlt · ${euroFmt(price)}`}
        </p>
        <button style={{ ...btnPrimary, padding: '16px 32px', fontSize: '1rem', background: 'white', color: '#00454A', borderRadius: '14px' }} onClick={onNewJob}>
          Zurück zu Aufträgen
        </button>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────

function MobileApp() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [screen, setScreen] = useState<Screen>('list');
  const [flow, setFlow] = useState<FlowState | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setChecking(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(u => setUser(u))
      .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); })
      .finally(() => setChecking(false));
  }, []);

  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); };

  const resetFlow = () => { setFlow(null); setScreen('list'); };

  if (checking) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00454A' }}>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem' }}>Laden…</p>
    </div>
  );

  if (!user) return <LoginScreen onLogin={u => setUser(u)} />;

  // Screens without header (full-screen)
  if (screen === 'timer' && flow) {
    return <TimerScreen flow={flow} onBack={() => setScreen('detail')}
      onStop={stopped => { setFlow(f => f ? { ...f, timelog: stopped } : f); setScreen('bericht'); }} />;
  }

  if (screen === 'abschluss' && flow) {
    return <AbschlussScreen flow={flow} onNewJob={resetFlow} />;
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#F9FAFB', maxWidth: '520px', margin: '0 auto' }}>
      <header style={{ background: '#00454A', color: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'max(12px, env(safe-area-inset-top))', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="" style={{ height: '26px', filter: 'brightness(0) invert(1)' }} />
          <div>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Helferchen App</p>
            <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.7 }}>{user.full_name}</p>
          </div>
        </div>
        <button onClick={logout} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '5px 10px', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer' }}>
          Abmelden
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {screen === 'list' && (
          <ListScreen user={user} onSelect={a => {
            setFlow({ assignment: a, timelog: null, notes: '', reportId: null, signatureData: '', signerName: '', paymentMethod: null, savedWithoutPayment: false });
            setScreen('detail');
          }} />
        )}

        {screen === 'detail' && flow && (
          <DetailScreen flow={flow} onBack={resetFlow}
            onStartTimer={tl => { setFlow(f => f ? { ...f, timelog: tl } : f); setScreen('timer'); }}
            onContinue={tl => { setFlow(f => f ? { ...f, timelog: tl } : f); setScreen('timer'); }}
          />
        )}

        {screen === 'bericht' && flow && (
          <BerichtScreen flow={flow} onBack={() => setScreen('detail')}
            onNext={notes => { setFlow(f => f ? { ...f, notes } : f); setScreen('zusammenfassung'); }}
          />
        )}

        {screen === 'zusammenfassung' && flow && (
          <ZusammenfassungScreen flow={flow} onBack={() => setScreen('bericht')}
            onSign={(signerName, sigData, reportId) => {
              setFlow(f => f ? { ...f, signerName, signatureData: sigData, reportId } : f);
              setScreen('zahlung');
            }}
          />
        )}

        {screen === 'zahlung' && flow && (
          <ZahlungScreen flow={flow} onBack={() => setScreen('zusammenfassung')}
            onDone={method => {
              if (method === 'bar') {
                fetch(`${API}/assignments/${flow.assignment.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'completed' }) });
              }
              setFlow(f => f ? { ...f, paymentMethod: method === 'bar' ? 'bar' : null, savedWithoutPayment: method === 'saved' } : f);
              setScreen('abschluss');
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Shared Styles ──────────────────────────────────────────────────────────────

const screenWrap: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const headerBar: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'white', borderBottom: '1px solid #F3F4F6', flexShrink: 0 };
const backBtn: React.CSSProperties = { width: '40px', height: '40px', border: 'none', background: '#F3F4F6', borderRadius: '50%', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontWeight: 300 };
const bottomBar: React.CSSProperties = { padding: '16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', background: 'white', borderTop: '1px solid #F3F4F6', flexShrink: 0 };
const card: React.CSSProperties = { background: 'white', borderRadius: '16px', padding: '18px', marginBottom: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' };
const cardTitle: React.CSSProperties = { margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 700, color: '#111827' };
const detail: React.CSSProperties = { display: 'flex', flexDirection: 'column', margin: '0 0 10px' };
const detailLabel: React.CSSProperties = { fontSize: '0.75rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' };
const errBox: React.CSSProperties = { background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.88rem' };
const iStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1.5px solid #E5E7EB', borderRadius: '10px', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'white' };
const btnPrimary: React.CSSProperties = { background: '#00454A', color: 'white', border: 'none', borderRadius: '10px', padding: '12px 20px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' };
const btnOutline: React.CSSProperties = { background: 'white', color: '#374151', border: '1.5px solid #E5E7EB', borderRadius: '10px', padding: '12px 20px', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer' };

export default MobileApp;
