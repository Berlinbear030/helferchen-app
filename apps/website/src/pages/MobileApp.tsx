/**
 * Helferchen Mobile App — iOS-style wizard flow
 * Pricing: 20€ first 15min, +15€ per additional 15min block (rounded up)
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const API = '/api';
const BG = '#F2F2F7';         // iOS system background
const CARD = '#FFFFFF';
const GREEN = '#00454A';
const GREEN_LIGHT = '#E6F4F3';
const LABEL = '#3C3C43';
const SUBLABEL = '#8E8E93';
const SEPARATOR = '#C6C6C8';
const DANGER = '#FF3B30';

interface User { id: string; full_name: string; role: string; email?: string; }
interface Customer { id: string; first_name: string; last_name: string; address: string; phone_number?: string; email?: string; }
interface Assignment { id: string; title: string; description: string; scheduled_at: string; status: string; customer: Customer; assigned_user_id?: string; hourly_rate?: number; }
interface Timelog { id: string; assignment_id: string; start_time: string; end_time: string | null; is_signed: boolean; }
interface Report { id: string; assignment_id: string; timelog_id: string; notes: string; created_at: string; signature_id: string | null; }

interface FlowState {
  assignment: Assignment;
  timelog: Timelog | null;
  notes: string;
  reportId: string | null;
  signatureData: string;
  signerName: string;
  paymentDone: boolean;
  savedWithoutPayment: boolean;
}

type Screen = 'list' | 'detail' | 'timer' | 'bericht' | 'zusammenfassung' | 'zahlung' | 'abschluss';

// ── Utilities ─────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

/** Parse MySQL datetime (UTC, no Z) correctly — fixes the 2h offset bug */
function utcMs(s: string): number {
  if (!s) return 0;
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s.replace(' ', 'T') + 'Z').getTime();
}

function pad(n: number) { return n < 10 ? '0' + n : String(n); }

function clock(iso: string) {
  const d = new Date(utcMs(iso));
  return `${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}

function dateLabel(iso: string) {
  return new Date(utcMs(iso)).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function elapsedMs(start: string, end: string | null): number {
  return (end ? utcMs(end) : Date.now()) - utcMs(start);
}

function fmtElapsed(ms: number, showHours = true): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (showHours && h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function calcMinutes(start: string, end: string | null): number {
  return Math.max(1, Math.ceil(elapsedMs(start, end) / 60000));
}

/** Pricing: 20€ first 15min, +15€ each additional 15min block (rounded up) */
function calcPrice(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes <= 15) return 20;
  return 20 + Math.ceil((minutes - 15) / 15) * 15;
}

function priceBreakdown(minutes: number): string {
  if (minutes <= 15) return 'Grundgebühr (bis 15 Min)';
  const extra = Math.ceil((minutes - 15) / 15);
  return `Grundgebühr + ${extra} × 15 Min`;
}

function euro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const F: React.CSSProperties = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" };

function NavBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(242,242,247,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${SEPARATOR}`, padding: '0 16px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ width: '72px' }}>
        {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: GREEN, fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, ...F }}>
          <span style={{ fontSize: '1.4rem', lineHeight: 1, marginTop: '-1px' }}>‹</span> Zurück
        </button>}
      </div>
      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#000', ...F }}>{title}</span>
      <div style={{ width: '72px', textAlign: 'right' }}>{right}</div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: CARD, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '16px', ...style }}>{children}</div>;
}

function Row({ label, value, chevron, onClick }: { label: string; value?: string; chevron?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', width: '100%', background: 'none', border: 'none', cursor: onClick ? 'pointer' : 'default', borderBottom: `1px solid ${SEPARATOR}`, ...F }}>
      <span style={{ color: LABEL, fontSize: '0.95rem' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {value && <span style={{ color: SUBLABEL, fontSize: '0.9rem' }}>{value}</span>}
        {chevron && <span style={{ color: SEPARATOR, fontSize: '1.1rem' }}>›</span>}
      </div>
    </button>
  );
}

function PrimaryBtn({ label, onClick, disabled, style }: { label: React.ReactNode; onClick: () => void; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: '16px', background: disabled ? '#A0A0A0' : GREEN, color: 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.15s', ...F, ...style }}>
      {label}
    </button>
  );
}

function SecondaryBtn({ label, onClick, disabled, style }: { label: React.ReactNode; onClick: () => void; disabled?: boolean; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: '14px', background: 'white', color: GREEN, border: `1.5px solid ${GREEN}`, borderRadius: '14px', fontSize: '0.95rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', ...F, ...style }}>
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <p style={{ margin: '0 0 6px', fontSize: '0.75rem', fontWeight: 600, color: SUBLABEL, textTransform: 'uppercase', letterSpacing: '0.05em', ...F }}>{label}</p>
      {children}
    </div>
  );
}

const inputSt: React.CSSProperties = { width: '100%', padding: '13px 14px', border: `1.5px solid ${SEPARATOR}`, borderRadius: '12px', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', background: 'white', outline: 'none' };

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [uname, setUname] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname, password: pass }) });
      if (!r.ok) { setErr('Benutzername oder Passwort falsch.'); return; }
      const d = await r.json();
      localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user));
      onLogin(d.user);
    } catch { setErr('Verbindungsfehler. Bitte erneut versuchen.'); } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100dvh', background: GREEN, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', ...F }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <img src="/logo.png" alt="Helferchen" style={{ height: '50px', filter: 'brightness(0) invert(1)' }} />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.8rem', margin: '0 0 6px', fontWeight: 800 }}>Helferchen</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0, fontSize: '1rem' }}>Mitarbeiter-App</p>
        </div>
        <div style={{ background: 'white', borderRadius: '24px', padding: '32px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          {err && <div style={{ background: '#FFF0F0', color: DANGER, padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 500 }}>{err}</div>}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input type="text" placeholder="Benutzername" value={uname} onChange={e => setUname(e.target.value)} required style={inputSt} autoCapitalize="none" autoCorrect="off" />
            <input type="password" placeholder="Passwort" value={pass} onChange={e => setPass(e.target.value)} required style={inputSt} />
            <button type="submit" disabled={busy} style={{ padding: '15px', background: GREEN, color: 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', marginTop: '4px', ...F }}>
              {busy ? 'Anmelden…' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Date Scroller ─────────────────────────────────────────────────────────────

function DateScroller({ selected, onChange }: { selected: string; onChange: (d: string) => void }) {
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - 7 + i);
    return d.toISOString().slice(0, 10);
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-selected="true"]`) as HTMLElement;
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  return (
    <div ref={scrollRef} style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 16px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {days.map(d => {
        const dt = new Date(d + 'T00:00:00');
        const isSelected = d === selected;
        const isToday = d === today.toISOString().slice(0, 10);
        return (
          <button key={d} data-selected={isSelected} onClick={() => onChange(d)}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 10px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: isSelected ? GREEN : 'white', boxShadow: isSelected ? 'none' : '0 1px 4px rgba(0,0,0,0.08)', minWidth: '48px', ...F }}>
            <span style={{ fontSize: '0.7rem', color: isSelected ? 'rgba(255,255,255,0.75)' : SUBLABEL, fontWeight: 500, textTransform: 'uppercase' }}>
              {dt.toLocaleDateString('de-DE', { weekday: 'short' })}
            </span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: isSelected ? 'white' : (isToday ? GREEN : LABEL), lineHeight: 1.2 }}>
              {dt.getDate()}
            </span>
            {isToday && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.6)' : GREEN, marginTop: '2px' }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── List Screen ───────────────────────────────────────────────────────────────

function ListScreen({ user, onSelect }: { user: User; onSelect: (a: Assignment) => void }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const [aR, tR] = await Promise.all([
        fetch(`${API}/assignments/my`, { headers: authHeaders() }),
        fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
      ]);
      if (aR.ok) setAssignments(await aR.json());
      if (tR.ok) setTimelogs(await tR.json());
      setLoading(false);
    })();
  }, []);

  const filtered = assignments.filter(a => a.scheduled_at?.startsWith(filterDate));
  const statusColor = (s: string) => ({ pending: '#8E8E93', in_progress: '#FF9500', completed: '#34C759' })[s] || '#8E8E93';
  const statusLabel = (s: string) => ({ pending: 'Ausstehend', in_progress: 'In Bearbeitung', completed: 'Abgeschlossen' })[s] || s;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG }}>
      <div style={{ background: GREEN, paddingTop: 'env(safe-area-inset-top)', paddingBottom: '0' }}>
        <div style={{ padding: '16px 16px 0', color: 'white' }}>
          <p style={{ margin: '0 0 2px', fontSize: '0.8rem', opacity: 0.7, ...F }}>Guten Tag,</p>
          <h2 style={{ margin: '0 0 14px', fontSize: '1.5rem', fontWeight: 800, ...F }}>{user.full_name}</h2>
        </div>
        <DateScroller selected={filterDate} onChange={setFilterDate} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: SUBLABEL, ...F }}>Lädt…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 16px' }}>📭</p>
            <p style={{ color: SUBLABEL, ...F }}>Keine Aufträge für diesen Tag.</p>
          </div>
        ) : (
          <Card>
            {filtered.map((a, i) => {
              const running = timelogs.find(t => t.assignment_id === a.id && !t.end_time);
              return (
                <button key={a.id} onClick={() => onSelect(a)}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: i < filtered.length - 1 ? `1px solid ${SEPARATOR}` : 'none', textAlign: 'left', ...F }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor(a.status), marginRight: '12px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: '0.98rem', color: LABEL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</p>
                    <p style={{ margin: 0, fontSize: '0.83rem', color: SUBLABEL }}>
                      {clock(a.scheduled_at)} · {a.customer?.first_name} {a.customer?.last_name}
                      {running ? ' · ⏱ läuft' : ''}
                    </p>
                  </div>
                  <span style={{ color: SEPARATOR, fontSize: '1.2rem', marginLeft: '8px' }}>›</span>
                </button>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Detail Screen ─────────────────────────────────────────────────────────────

function DetailScreen({ flow, onBack, onStart, onResume }: {
  flow: FlowState; onBack: () => void;
  onStart: (tl: Timelog) => void; onResume: (tl: Timelog) => void;
}) {
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { assignment } = flow;

  useEffect(() => {
    fetch(`${API}/timelogs/my`, { headers: authHeaders() }).then(r => r.ok ? r.json() : []).then(setTimelogs);
  }, []);

  const mine = timelogs.filter(t => t.assignment_id === assignment.id);
  const running = mine.find(t => !t.end_time);

  const start = async () => {
    setBusy(true); setErr('');
    const r = await fetch(`${API}/timelogs/start`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignment.id }) });
    if (r.ok) {
      const tl = await r.json();
      if (assignment.status === 'pending') await fetch(`${API}/assignments/${assignment.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'in_progress' }) });
      onStart(tl);
    } else { const d = await r.json(); setErr(d.message || 'Fehler'); }
    setBusy(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title={assignment.title} onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 24px', WebkitOverflowScrolling: 'touch' }}>
        {err && <div style={{ background: '#FFF0F0', color: DANGER, padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.9rem', ...F }}>{err}</div>}

        <Card>
          <div style={{ padding: '4px 0' }}>
            <Row label="Termin" value={`${dateLabel(assignment.scheduled_at)}, ${clock(assignment.scheduled_at)}`} />
            <Row label="Service" value={assignment.title} />
            {assignment.description && <Row label="Beschreibung" value={assignment.description} />}
            <Row label="Stundensatz" value="(Pauschal: 20€ / 15min)"/>
          </div>
        </Card>

        {assignment.customer && (
          <Card>
            <div style={{ padding: '4px 0' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${SEPARATOR}` }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700, color: LABEL, fontSize: '1rem', ...F }}>{assignment.customer.first_name} {assignment.customer.last_name}</p>
                <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.88rem', ...F }}>{assignment.customer.address}</p>
              </div>
              {assignment.customer.phone_number && <Row label="Telefon" value={assignment.customer.phone_number} />}
              <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(assignment.customer.address)}`, '_blank')}
                style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', color: GREEN, fontSize: '0.95rem', fontWeight: 600, ...F }}>
                📍 In Maps öffnen ↗
              </button>
            </div>
          </Card>
        )}

        {running && (
          <div style={{ background: '#E9F9EE', border: '1px solid #34C759', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ margin: '0 0 10px', color: '#1C7B37', fontWeight: 700, ...F }}>⏱ Timer läuft gerade</p>
            <PrimaryBtn label="Zum laufenden Timer →" onClick={() => onResume(running)} />
          </div>
        )}
      </div>
      {!running && (
        <div style={{ padding: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'white', borderTop: `1px solid ${SEPARATOR}` }}>
          <PrimaryBtn label={busy ? 'Startet…' : '⏱ Timer starten'} onClick={start} disabled={busy} />
        </div>
      )}
    </div>
  );
}

// ── Timer Screen ──────────────────────────────────────────────────────────────

function TimerScreen({ flow, onBack, onStop }: {
  flow: FlowState; onBack: () => void; onStop: (tl: Timelog) => void;
}) {
  const { assignment, timelog } = flow;
  const [ms, setMs] = useState(timelog ? elapsedMs(timelog.start_time, null) : 0);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!timelog) return;
    const tick = () => setMs(elapsedMs(timelog.start_time, null));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [timelog]);

  const stop = async () => {
    if (!timelog) return;
    setStopping(true);
    const r = await fetch(`${API}/timelogs/stop`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ timelog_id: timelog.id }) });
    if (r.ok) onStop(await r.json());
    setStopping(false);
  };

  const mins = Math.floor(ms / 60000);
  const price = calcPrice(mins);

  return (
    <div style={{ minHeight: '100dvh', background: GREEN, display: 'flex', flexDirection: 'column', ...F, paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 0' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', color: 'white', fontWeight: 700, fontSize: '1rem' }}>Timer läuft</span>
        <div style={{ width: '40px' }} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', margin: '0 0 4px' }}>{assignment.title}</p>
        {assignment.customer && <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.9rem', margin: '0 0 56px' }}>👤 {assignment.customer.first_name} {assignment.customer.last_name}</p>}

        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2px' }}>
            {Math.floor(ms / 3600000) > 0 && <>
              <span style={{ fontSize: '5rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>{pad(Math.floor(ms / 3600000))}</span>
              <span style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.15, marginBottom: '4px' }}>:</span>
            </>}
            <span style={{ fontSize: '5rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>{pad(Math.floor((ms % 3600000) / 60000))}</span>
            <span style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.15, marginBottom: '4px' }}>:</span>
            <span style={{ fontSize: '5rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>{pad(Math.floor((ms % 60000) / 1000))}</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', margin: '12px 0 0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {timelog ? `Gestartet um ${clock(timelog.start_time)}` : ''}
          </p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px 32px', textAlign: 'center', marginBottom: '56px' }}>
          <p style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bisherige Kosten</p>
          <p style={{ margin: 0, color: 'white', fontSize: '2rem', fontWeight: 800 }}>{euro(price)}</p>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{mins} Min · {priceBreakdown(mins)}</p>
        </div>
      </div>

      <div style={{ padding: '16px 24px', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
        <button onClick={stop} disabled={stopping} style={{ width: '100%', padding: '18px', background: DANGER, color: 'white', border: 'none', borderRadius: '16px', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', ...F }}>
          {stopping ? 'Stoppt…' : '⏹ Timer stoppen'}
        </button>
      </div>
    </div>
  );
}

// ── Bericht Screen ─────────────────────────────────────────────────────────────

function BerichtScreen({ flow, onBack, onNext }: {
  flow: FlowState; onBack: () => void; onNext: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(flow.notes);
  const { assignment, timelog } = flow;
  const mins = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const price = calcPrice(mins);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title="Bericht" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 24px', WebkitOverflowScrolling: 'touch' }}>
        <Card>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SEPARATOR}` }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '1.05rem', color: LABEL, ...F }}>{assignment.customer?.first_name} {assignment.customer?.last_name}</p>
            <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.88rem', ...F }}>{assignment.customer?.address}</p>
          </div>
          {timelog && (
            <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: LABEL, fontSize: '0.95rem', ...F }}>Arbeitszeit</span>
              <span style={{ color: SUBLABEL, fontWeight: 600, fontSize: '0.9rem', ...F }}>
                {clock(timelog.start_time)} – {timelog.end_time ? clock(timelog.end_time) : '?'} ({mins} Min)
              </span>
            </div>
          )}
        </Card>

        <Card>
          <div style={{ padding: '16px' }}>
            <Field label="Was wurde erledigt?">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6}
                placeholder="Beschreibung der Arbeiten, verwendete Materialien, besondere Vorkommnisse…"
                style={{ ...inputSt, resize: 'vertical', minHeight: '130px', lineHeight: 1.55 }}
                autoFocus
              />
            </Field>
          </div>
        </Card>

        <Card style={{ background: GREEN_LIGHT }}>
          <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: '0 0 3px', color: '#004A4A', fontWeight: 600, fontSize: '0.9rem', ...F }}>Gesamtbetrag</p>
              <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.78rem', ...F }}>{priceBreakdown(mins)}</p>
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: GREEN, ...F }}>{euro(price)}</span>
          </div>
        </Card>
      </div>
      <div style={{ padding: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'white', borderTop: `1px solid ${SEPARATOR}` }}>
        <PrimaryBtn label="Weiter zur Zusammenfassung →" onClick={() => { if (notes.trim()) onNext(notes); }} disabled={!notes.trim()} />
      </div>
    </div>
  );
}

// ── Signature Canvas ───────────────────────────────────────────────────────────

function SigCanvas({ onSave }: { onSave: (url: string) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [has, setHas] = useState(false);

  const getXY = (e: React.TouchEvent | React.MouseEvent, c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width, sy = c.height / r.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    const m = e as React.MouseEvent; return { x: (m.clientX - r.left) * sx, y: (m.clientY - r.top) * sy };
  };
  const startDraw = (e: React.TouchEvent | React.MouseEvent) => { e.preventDefault(); const c = cv.current!; c.getContext('2d')!.beginPath(); c.getContext('2d')!.moveTo(...Object.values(getXY(e, c)) as [number, number]); drawing.current = true; };
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault(); if (!drawing.current) return;
    const c = cv.current!; const ctx = c.getContext('2d')!;
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000';
    const p = getXY(e, c); ctx.lineTo(p.x, p.y); ctx.stroke(); setHas(true);
  };
  const stopDraw = () => { drawing.current = false; };
  const clear = () => { cv.current!.getContext('2d')!.clearRect(0, 0, 640, 200); setHas(false); };

  return (
    <div>
      <canvas ref={cv} width={640} height={200}
        style={{ width: '100%', height: '120px', border: `1.5px dashed ${SEPARATOR}`, borderRadius: '12px', background: '#FAFAFA', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button style={{ flex: 1, padding: '10px', background: 'white', border: `1px solid ${SEPARATOR}`, borderRadius: '10px', color: LABEL, fontSize: '0.9rem', cursor: 'pointer', ...F }} onClick={clear}>Löschen</button>
        <button style={{ flex: 2, padding: '10px', background: has ? GREEN : '#ccc', color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, cursor: has ? 'pointer' : 'not-allowed', ...F }} disabled={!has}
          onClick={() => has && onSave(cv.current!.toDataURL('image/png'))}>
          ✓ Unterschrift übernehmen
        </button>
      </div>
    </div>
  );
}

// ── Zusammenfassung Screen ─────────────────────────────────────────────────────

function ZusammenfassungScreen({ flow, onBack, onSigned }: {
  flow: FlowState; onBack: () => void;
  onSigned: (signerName: string, sigData: string, reportId: string) => void;
}) {
  const { assignment, timelog, notes } = flow;
  const [signerName, setSigner] = useState(assignment.customer ? `${assignment.customer.first_name} ${assignment.customer.last_name}` : '');
  const [sigData, setSigData] = useState(flow.signatureData);
  const [reportId, setReportId] = useState(flow.reportId);
  const [saving, setSaving] = useState(false);
  const [creatingReport, setCreatingReport] = useState(!flow.reportId);
  const [err, setErr] = useState('');

  const mins = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const price = calcPrice(mins);

  // Ensure report exists
  useEffect(() => {
    if (reportId || !timelog?.end_time) return;
    (async () => {
      setCreatingReport(true);
      const r = await fetch(`${API}/reports`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignment.id, timelog_id: timelog.id, notes }) });
      if (r.ok) { setReportId((await r.json()).id); }
      else if (r.status === 409) {
        // Already exists — fetch it
        const all = await fetch(`${API}/reports/my`, { headers: authHeaders() });
        if (all.ok) {
          const list: Report[] = await all.json();
          const found = list.find(x => x.timelog_id === timelog.id);
          if (found) setReportId(found.id);
        }
      }
      setCreatingReport(false);
    })();
  }, []);

  const handleSign = async () => {
    if (!sigData || !signerName.trim()) { setErr('Bitte Unterschrift und Name eintragen.'); return; }
    if (!reportId) { setErr('Bericht wird noch erstellt, bitte kurz warten…'); return; }
    setSaving(true); setErr('');
    const r = await fetch(`${API}/signatures`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ report_id: reportId, image_data: sigData, signer_name: signerName }) });
    if (r.ok) { onSigned(signerName, sigData, reportId); }
    else { const d = await r.json(); setErr(d.message || 'Fehler beim Speichern.'); }
    setSaving(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title="Zusammenfassung" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 24px', WebkitOverflowScrolling: 'touch' }}>
        {err && <div style={{ background: '#FFF0F0', color: DANGER, padding: '12px 14px', borderRadius: '12px', marginBottom: '14px', fontSize: '0.9rem', ...F }}>{err}</div>}

        {/* Invoice card */}
        <div style={{ background: 'white', borderRadius: '20px', padding: '20px', marginBottom: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <div style={{ width: '36px', height: '36px', background: GREEN, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo.png" alt="" style={{ height: '22px', filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: LABEL, ...F }}>Helferchen</p>
              <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.78rem', ...F }}>Arbeitsnachweis</p>
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${BG}`, paddingTop: '14px', marginBottom: '14px' }}>
            <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: '1.05rem', color: LABEL, ...F }}>{assignment.customer?.first_name} {assignment.customer?.last_name}</p>
            <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.88rem', ...F }}>{assignment.customer?.address}</p>
          </div>

          <div style={{ background: BG, borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.85rem', color: SUBLABEL, ...F }}>Service</span>
              <span style={{ fontSize: '0.85rem', color: LABEL, fontWeight: 500, ...F }}>{assignment.title}</span>
            </div>
            {timelog && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.85rem', color: SUBLABEL, ...F }}>Arbeitszeit</span>
                <span style={{ fontSize: '0.85rem', color: LABEL, fontWeight: 500, ...F }}>
                  {clock(timelog.start_time)} – {timelog.end_time ? clock(timelog.end_time) : '?'} ({mins} Min)
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', color: SUBLABEL, ...F }}>Abrechnung</span>
              <span style={{ fontSize: '0.85rem', color: LABEL, fontWeight: 500, ...F }}>{priceBreakdown(mins)}</span>
            </div>
          </div>

          {notes && (
            <div style={{ borderTop: `1px solid ${BG}`, paddingTop: '12px', marginBottom: '14px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: SUBLABEL, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', ...F }}>Bericht</p>
              <p style={{ margin: 0, color: LABEL, fontSize: '0.9rem', lineHeight: 1.55, ...F }}>{notes}</p>
            </div>
          )}

          <div style={{ borderTop: `2px solid ${LABEL}`, paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: LABEL, ...F }}>Gesamtbetrag</span>
            <span style={{ fontWeight: 800, fontSize: '1.8rem', color: GREEN, ...F }}>{euro(price)}</span>
          </div>
        </div>

        {/* Signature */}
        <Card>
          <div style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 14px', fontWeight: 700, color: LABEL, ...F }}>Unterschrift des Kunden</p>
            <Field label="Name">
              <input type="text" value={signerName} onChange={e => setSigner(e.target.value)} placeholder="Vor- und Nachname" style={inputSt} />
            </Field>
            <SigCanvas onSave={d => setSigData(d)} />
            {sigData && (
              <div style={{ marginTop: '12px', padding: '10px', background: BG, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#34C759', fontSize: '1.2rem' }}>✓</span>
                <img src={sigData} alt="Unterschrift" style={{ height: '40px' }} />
              </div>
            )}
          </div>
        </Card>
      </div>
      <div style={{ padding: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'white', borderTop: `1px solid ${SEPARATOR}` }}>
        <PrimaryBtn
          label={saving ? 'Speichert…' : creatingReport ? 'Bericht wird erstellt…' : 'Weiter zur Zahlung →'}
          onClick={handleSign}
          disabled={saving || creatingReport || !sigData || !signerName.trim()}
        />
      </div>
    </div>
  );
}

// ── Zahlung Screen ─────────────────────────────────────────────────────────────

function ZahlungScreen({ flow, onBack, onDone }: {
  flow: FlowState; onBack: () => void; onDone: (method: 'bar' | 'saved') => void;
}) {
  const { assignment, timelog } = flow;
  const mins = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const price = calcPrice(mins);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailDone, setEmailDone] = useState(false);

  const downloadPdf = () => {
    if (!flow.reportId) return;
    const a = document.createElement('a');
    a.href = `${API}/pdf/${flow.reportId}`;
    a.setAttribute('download', `bericht.pdf`);
    a.setAttribute('target', '_blank');
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const emailPdf = async () => {
    const email = assignment.customer?.email || prompt('E-Mail-Adresse des Kunden:');
    if (!email || !flow.reportId) return;
    setEmailBusy(true);
    await fetch(`${API}/pdf/${flow.reportId}/email`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ to: email }) });
    setEmailBusy(false); setEmailDone(true);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title="Zahlung" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 24px', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '72px', height: '72px', background: GREEN_LIGHT, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ fontSize: '2rem' }}>💶</span>
          </div>
          <p style={{ margin: '0 0 6px', color: SUBLABEL, fontSize: '0.9rem', ...F }}>Offener Betrag</p>
          <p style={{ margin: 0, fontSize: '2.8rem', fontWeight: 800, color: LABEL, ...F }}>{euro(price)}</p>
          <p style={{ margin: '6px 0 0', color: SUBLABEL, fontSize: '0.82rem', ...F }}>{mins} Min · {priceBreakdown(mins)}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <button onClick={() => onDone('bar')} style={{ padding: '20px 24px', background: GREEN, color: 'white', border: 'none', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', ...F }}>
            <span style={{ fontSize: '2rem' }}>💵</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>Bar bezahlt</p>
              <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.75 }}>Auftrag wird abgeschlossen</p>
            </div>
          </button>

          <button disabled style={{ padding: '20px 24px', background: '#F2F2F7', color: '#C7C7CC', border: 'none', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'not-allowed', ...F }}>
            <span style={{ fontSize: '2rem', opacity: 0.4 }}>💳</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>Mit Karte</p>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>Demnächst verfügbar</p>
            </div>
          </button>

          <button onClick={() => onDone('saved')} style={{ padding: '18px 24px', background: 'white', color: LABEL, border: `1.5px solid ${SEPARATOR}`, borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', ...F }}>
            <span style={{ fontSize: '2rem' }}>💾</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.98rem' }}>Zwischenspeichern</p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: SUBLABEL }}>Kunde zahlt später</p>
            </div>
          </button>
        </div>

        <Card>
          <div style={{ padding: '14px 16px' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700, color: LABEL, ...F }}>Quittung senden</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <SecondaryBtn label="📄 PDF" onClick={downloadPdf} style={{ flex: 1 }} />
              <SecondaryBtn label={emailDone ? '✓ Gesendet' : emailBusy ? '…' : '📧 E-Mail'} onClick={emailPdf} disabled={emailBusy || emailDone} style={{ flex: 1 }} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Abschluss Screen ───────────────────────────────────────────────────────────

function AbschlussScreen({ flow, onReset }: { flow: FlowState; onReset: () => void }) {
  const { assignment, timelog } = flow;
  const mins = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const price = calcPrice(mins);

  return (
    <div style={{ minHeight: '100dvh', background: GREEN, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', ...F, paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        <div style={{ fontSize: '5rem', marginBottom: '24px' }}>✅</div>
        <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 800, margin: '0 0 12px' }}>Fertig!</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0 0 6px', fontSize: '1.05rem' }}>{assignment.title}</p>
        <p style={{ color: 'rgba(255,255,255,0.65)', margin: '0 0 40px', fontSize: '0.9rem' }}>
          {flow.savedWithoutPayment ? '💾 Gespeichert · Zahlung ausstehend' : `💵 Bar bezahlt · ${euro(price)}`}
        </p>
        <button onClick={onReset} style={{ padding: '16px 40px', background: 'white', color: GREEN, border: 'none', borderRadius: '16px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', ...F }}>
          Zurück zu Aufträgen
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MobileApp() {
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

  const upd = useCallback((patch: Partial<FlowState>) => setFlow(f => f ? { ...f, ...patch } : f), []);
  const reset = () => { setFlow(null); setScreen('list'); };
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); };

  if (checking) return (
    <div style={{ minHeight: '100dvh', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'rgba(255,255,255,0.6)', ...F }}>Laden…</p>
    </div>
  );

  if (!user) return <LoginScreen onLogin={u => setUser(u)} />;

  // Full-screen screens
  if (screen === 'timer' && flow) return (
    <TimerScreen flow={flow} onBack={() => setScreen('detail')}
      onStop={tl => { upd({ timelog: tl }); setScreen('bericht'); }} />
  );
  if (screen === 'abschluss' && flow) return <AbschlussScreen flow={flow} onReset={reset} />;

  return (
    <div style={{ minHeight: '100dvh', maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', background: BG, ...F }}>
      {/* App header — only on list screen */}
      {screen === 'list' && (
        <div style={{ background: GREEN, paddingTop: 'env(safe-area-inset-top)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: `env(safe-area-inset-top) 16px 0` }}>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '7px 14px', borderRadius: '20px', fontSize: '0.82rem', cursor: 'pointer', ...F }}>
            Abmelden
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {screen === 'list' && flow === null && (
          <ListScreen user={user} onSelect={a => {
            setFlow({ assignment: a, timelog: null, notes: '', reportId: null, signatureData: '', signerName: '', paymentDone: false, savedWithoutPayment: false });
            setScreen('detail');
          }} />
        )}
        {screen === 'detail' && flow && (
          <DetailScreen flow={flow} onBack={reset}
            onStart={tl => { upd({ timelog: tl }); setScreen('timer'); }}
            onResume={tl => { upd({ timelog: tl }); setScreen('timer'); }} />
        )}
        {screen === 'bericht' && flow && (
          <BerichtScreen flow={flow} onBack={() => setScreen('detail')}
            onNext={notes => { upd({ notes }); setScreen('zusammenfassung'); }} />
        )}
        {screen === 'zusammenfassung' && flow && (
          <ZusammenfassungScreen flow={flow} onBack={() => setScreen('bericht')}
            onSigned={(signerName, sigData, reportId) => { upd({ signerName, signatureData: sigData, reportId }); setScreen('zahlung'); }} />
        )}
        {screen === 'zahlung' && flow && (
          <ZahlungScreen flow={flow} onBack={() => setScreen('zusammenfassung')}
            onDone={method => {
              if (method === 'bar') fetch(`${API}/assignments/${flow.assignment.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'completed' }) });
              upd({ paymentDone: method === 'bar', savedWithoutPayment: method === 'saved' });
              setScreen('abschluss');
            }} />
        )}
      </div>
    </div>
  );
}
