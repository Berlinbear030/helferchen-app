/**
 * Helferchen Mobile App — iOS-style wizard + customer overview
 * Pricing: 25€ first 15min (inkl. Anfahrt), +20€ per additional started 15min block
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API = '/api';
const BG = '#F2F2F7';
const CARD = '#FFFFFF';
const GREEN = '#00454A';
const GREEN_LIGHT = '#E6F4F3';
const LABEL = '#1C1C1E';
const SUBLABEL = '#8E8E93';
const SEP = '#C6C6C8';
const DANGER = '#FF3B30';
const ORANGE = '#FF9500';
const SUCCESS = '#34C759';

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
  kundeNichtDa: boolean;
}

type Screen = 'list' | 'tour' | 'kunden' | 'kunde_detail' | 'detail' | 'timer' | 'bericht' | 'zusammenfassung' | 'zahlung' | 'quittung' | 'abschluss' | 'kunde_nicht_da';

// ── Utilities ─────────────────────────────────────────────────────────────────

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}

function utcMs(s: string): number {
  if (!s) return 0;
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s.replace(' ', 'T') + 'Z').getTime();
}

function pad(n: number) { return n < 10 ? '0' + n : String(n); }
function clock(iso: string) { const d = new Date(utcMs(iso)); return `${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`; }
function dateLabel(iso: string) { return new Date(utcMs(iso)).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function weekdayShort(iso: string) { return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short' }); }
function elapsedMs(start: string, end: string | null) { return (end ? utcMs(end) : Date.now()) - utcMs(start); }
function calcMinutes(start: string, end: string | null) { return Math.max(0, Math.ceil(elapsedMs(start, end) / 60000)); }

function calcPrice(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes <= 15) return 25;
  return 25 + Math.ceil((minutes - 15) / 15) * 20;
}
function priceBreakdown(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes <= 15) return 'Grundgebühr inkl. Anfahrt (bis 15 Min)';
  return `Grundgebühr inkl. Anfahrt + ${Math.ceil((minutes - 15) / 15)} × 15 Min`;
}
function euro(n: number) { return n.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €'; }

// ── Geocoding (Nominatim, module-level cache) ──────────────────────────────────

const geocodeCache = new Map<string, [number, number] | null>();

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (geocodeCache.has(address)) return geocodeCache.get(address)!;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'de' } }
    );
    const data = await r.json();
    const result: [number, number] | null = data.length > 0
      ? [parseFloat(data[0].lat), parseFloat(data[0].lon)]
      : null;
    geocodeCache.set(address, result);
    return result;
  } catch {
    geocodeCache.set(address, null);
    return null;
  }
}

// ── PDF download with auth ─────────────────────────────────────────────────────
async function downloadPdfBlob(reportId: string): Promise<void> {
  try {
    const r = await fetch(`${API}/pdf/${reportId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    if (!r.ok) { alert('PDF konnte nicht geladen werden (Fehler ' + r.status + ')'); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `helferchen-bericht.pdf`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 2000);
  } catch (e) { alert('Fehler beim PDF-Download'); }
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

const F: React.CSSProperties = { fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif" };

function NavBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(242,242,247,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${SEP}`, padding: '0 16px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 10, ...F }}>
      <div style={{ width: '80px' }}>
        {onBack && <button onClick={onBack} style={{ background: 'none', border: 'none', color: GREEN, fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0, ...F }}>
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>‹</span> Zurück
        </button>}
      </div>
      <span style={{ fontWeight: 700, fontSize: '1rem', color: LABEL, ...F }}>{title}</span>
      <div style={{ width: '80px', textAlign: 'right' }}>{right}</div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: CARD, borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '14px', ...style }}>{children}</div>;
}

function ListItem({ primary, secondary, right, onPress, last }: { primary: string; secondary?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean }) {
  return (
    <button onClick={onPress} disabled={!onPress} style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '13px 16px', background: 'none', border: 'none', cursor: onPress ? 'pointer' : 'default', borderBottom: last ? 'none' : `1px solid ${SEP}`, textAlign: 'left', ...F }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 500, fontSize: '0.97rem', color: LABEL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{primary}</p>
        {secondary && <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: SUBLABEL }}>{secondary}</p>}
      </div>
      {right || (onPress && <span style={{ color: SEP, fontSize: '1.2rem', marginLeft: '8px' }}>›</span>)}
    </button>
  );
}

function Btn({ label, onClick, disabled, variant = 'primary', style }: { label: React.ReactNode; onClick: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; style?: React.CSSProperties }) {
  const bg = variant === 'primary' ? GREEN : variant === 'danger' ? DANGER : 'white';
  const color = variant === 'ghost' ? GREEN : variant === 'primary' || variant === 'danger' ? 'white' : LABEL;
  const border = variant === 'secondary' ? `1.5px solid ${SEP}` : variant === 'ghost' ? 'none' : 'none';
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: '100%', padding: '15px', background: disabled ? '#C7C7CC' : bg, color: disabled ? 'white' : color, border, borderRadius: '14px', fontSize: '0.97rem', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', ...F, ...style }}>
      {label}
    </button>
  );
}

const inputSt: React.CSSProperties = { width: '100%', padding: '13px 14px', border: `1.5px solid ${SEP}`, borderRadius: '12px', fontSize: '1rem', fontFamily: 'inherit', boxSizing: 'border-box', background: 'white', outline: 'none', ...F };

// ── Login ─────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [uname, setUname] = useState(''); const [pass, setPass] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname, password: pass }) });
      if (!r.ok) { setErr('Benutzername oder Passwort falsch.'); return; }
      const d = await r.json(); localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); onLogin(d.user);
    } catch { setErr('Verbindungsfehler.'); } finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: '100dvh', background: GREEN, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', ...F }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.15)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <img src="/logo.png" alt="Helferchen" style={{ height: '50px', filter: 'brightness(0) invert(1)' }} />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.8rem', margin: '0 0 6px', fontWeight: 800 }}>Helferchen</h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', margin: 0 }}>Mitarbeiter-App</p>
        </div>
        <div style={{ background: 'white', borderRadius: '24px', padding: '32px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          {err && <div style={{ background: '#FFF0F0', color: DANGER, padding: '12px 14px', borderRadius: '12px', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 500 }}>{err}</div>}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input type="text" placeholder="Benutzername" value={uname} onChange={e => setUname(e.target.value)} required style={inputSt} autoCapitalize="none" autoCorrect="off" />
            <input type="password" placeholder="Passwort" value={pass} onChange={e => setPass(e.target.value)} required style={inputSt} />
            <button type="submit" disabled={busy} style={{ padding: '15px', background: GREEN, color: 'white', border: 'none', borderRadius: '14px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', ...F }}>
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
  const today = new Date().toISOString().slice(0, 10);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 7 + i); return d.toISOString().slice(0, 10);
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector('[data-sel="1"]') as HTMLElement;
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selected]);
  return (
    <div ref={ref} style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '10px 16px 12px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {days.map(d => {
        const sel = d === selected;
        const isToday = d === today;
        return (
          <button key={d} data-sel={sel ? '1' : '0'} onClick={() => onChange(d)}
            style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 10px', borderRadius: '14px', border: 'none', cursor: 'pointer', background: sel ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)', minWidth: '48px', ...F }}>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.65)', fontWeight: 500, textTransform: 'uppercase' }}>{weekdayShort(d)}</span>
            <span style={{ fontSize: '1.1rem', fontWeight: sel ? 800 : 600, color: 'white', lineHeight: 1.3 }}>{parseInt(d.slice(8))}</span>
            {isToday && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: sel ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)', marginTop: '2px' }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Bottom Tab Bar ─────────────────────────────────────────────────────────────

const TAB_CONFIG = [
  { key: 'heute', icon: '📅', label: 'Heute' },
  { key: 'tour',  icon: '🗺️', label: 'Tour' },
  { key: 'kunden', icon: '👥', label: 'Kunden' },
] as const;

type Tab = 'heute' | 'tour' | 'kunden';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: 'flex', background: 'rgba(242,242,247,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: `1px solid ${SEP}`, paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0 }}>
      {TAB_CONFIG.map(({ key, icon, label }) => (
        <button key={key} onClick={() => onChange(key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 4px', border: 'none', background: 'transparent', cursor: 'pointer', color: active === key ? GREEN : SUBLABEL, ...F }}>
          <span style={{ fontSize: '1.4rem' }}>{icon}</span>
          <span style={{ fontSize: '0.68rem', fontWeight: active === key ? 700 : 400, marginTop: '2px' }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Tour (map with flag markers) ──────────────────────────────────────────────

function TourScreen({ user: _user, onRefresh }: { user: User; onRefresh: () => void }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [mapData, setMapData] = useState<{ mine: Assignment[]; unassigned: Assignment[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/assignments/map`, { headers: authHeaders() });
      if (r.ok) setMapData(await r.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Initialize Leaflet map (once, when container is mounted)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([51.1657, 10.4515], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add markers whenever map data changes
  useEffect(() => {
    if (!mapData || !mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    let cancelled = false;
    const currentMap = mapRef.current;

    const makeFlag = (fill: string, stroke: string) => L.divIcon({
      html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="1" x2="4" y2="38" stroke="#333" stroke-width="2.5" stroke-linecap="round"/><polygon points="4,2 26,9 4,18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/></svg>`,
      iconSize: [28, 38],
      iconAnchor: [4, 38],
      popupAnchor: [8, -38],
      className: '',
    });

    const yellowFlag = makeFlag('#FFD60A', '#c8a600');
    const greenFlag  = makeFlag('#34C759', '#1a8c38');

    const addAll = async () => {
      const all = [
        ...mapData.unassigned.map(a => ({ ...a, _kind: 'unassigned' as const })),
        ...mapData.mine.map(a => ({ ...a, _kind: 'mine' as const })),
      ];
      const bounds: L.LatLngTuple[] = [];

      for (const a of all) {
        if (cancelled || !a.customer?.address) continue;
        const coords = await geocodeAddress(a.customer.address);
        if (cancelled || !coords || !mapRef.current) continue;

        bounds.push(coords);
        const icon = a._kind === 'unassigned' ? yellowFlag : greenFlag;
        const marker = L.marker(coords, { icon }).addTo(mapRef.current);

        const dt = a.scheduled_at ? `${dateLabel(a.scheduled_at)} ${clock(a.scheduled_at)}` : '—';
        const cust = `${a.customer.first_name} ${a.customer.last_name}`;

        if (a._kind === 'unassigned') {
          const btnId = `sa-${a.id}`;
          marker.bindPopup(`
            <div style="min-width:210px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:4px">
              <div style="font-size:0.75rem;font-weight:700;color:#a07800;margin-bottom:6px">🚩 Nicht zugewiesen</div>
              <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px">${a.title}</div>
              <div style="font-size:0.8rem;color:#555;margin-bottom:2px">${cust}</div>
              <div style="font-size:0.8rem;color:#888;margin-bottom:10px">📅 ${dt}</div>
              <button id="${btnId}" style="width:100%;padding:9px 0;background:#00454A;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;font-family:inherit">
                ✋ Auftrag annehmen
              </button>
            </div>
          `);
          marker.on('popupopen', () => {
            const btn = document.getElementById(btnId) as HTMLButtonElement | null;
            if (!btn) return;
            btn.onclick = async () => {
              btn.disabled = true;
              btn.textContent = 'Wird zugewiesen…';
              const r = await fetch(`${API}/assignments/${a.id}/self-assign`, { method: 'POST', headers: authHeaders() });
              if (r.ok) {
                currentMap.closePopup();
                onRefresh();
                await fetchData();
              } else {
                const d = await r.json().catch(() => ({}));
                btn.textContent = d.message || 'Fehler';
                btn.style.background = '#FF3B30';
              }
            };
          });
        } else {
          const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(a.customer.address)}`;
          marker.bindPopup(`
            <div style="min-width:210px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:4px">
              <div style="font-size:0.75rem;font-weight:700;color:#1a7a38;margin-bottom:6px">✅ Mein Auftrag</div>
              <div style="font-weight:700;font-size:0.95rem;margin-bottom:2px">${a.title}</div>
              <div style="font-size:0.8rem;color:#555;margin-bottom:2px">${cust}</div>
              <div style="font-size:0.8rem;color:#888;margin-bottom:10px">📅 ${dt}</div>
              <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer"
                style="display:block;text-align:center;padding:9px 0;background:#00454A;color:white;border-radius:8px;font-weight:600;font-size:0.85rem;font-family:inherit;text-decoration:none">
                📍 Route planen ↗
              </a>
            </div>
          `);
        }

        markersRef.current.push(marker);
        await new Promise(r => setTimeout(r, 150)); // Nominatim rate-limit courtesy delay
      }

      if (!cancelled && bounds.length > 0 && mapRef.current) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    };

    addAll();
    return () => { cancelled = true; };
  }, [mapData, fetchData, onRefresh]);

  const totalCount = (mapData?.mine.length ?? 0) + (mapData?.unassigned.length ?? 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG }}>
      <div style={{ background: GREEN, paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h2 style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: '1.5rem', ...F }}>Tour</h2>
            <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', ...F }}>
              <span style={{ marginRight: '10px' }}>🚩 Gelb: verfügbar</span>
              <span>🚩 Grün: meine Aufträge</span>
            </p>
          </div>
          <button onClick={() => { geocodeCache.clear(); setMapData(null); fetchData(); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '12px', padding: '6px 14px', fontSize: '0.8rem', cursor: 'pointer', ...F }}>
            ↻
          </button>
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1 }}>
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        {loading && !mapData && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG, zIndex: 10 }}>
            <p style={{ color: SUBLABEL, ...F }}>Karte wird geladen…</p>
          </div>
        )}
        {!loading && totalCount === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: '16px', padding: '20px 28px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
              <p style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>🗺️</p>
              <p style={{ color: SUBLABEL, margin: 0, ...F }}>Keine Aufträge in der Karte.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Heute (assignment list) ───────────────────────────────────────────────────

function HeuteScreen({ user, assignments, timelogs, onSelect }: {
  user: User; assignments: Assignment[]; timelogs: Timelog[];
  onSelect: (a: Assignment) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const filtered = assignments.filter(a => a.scheduled_at?.startsWith(date));
  const sc = (s: string) => ({ pending: SUBLABEL, in_progress: ORANGE, completed: SUCCESS })[s] || SUBLABEL;
  const sl = (s: string) => ({ pending: 'Ausstehend', in_progress: 'In Bearbeitung', completed: 'Abgeschlossen' })[s] || s;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG }}>
      <div style={{ background: GREEN, paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px 0' }}>
          <p style={{ margin: '0 0 2px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', ...F }}>Guten Tag,</p>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.5rem', fontWeight: 800, color: 'white', ...F }}>{user.full_name}</h2>
        </div>
        <DateScroller selected={date} onChange={setDate} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', WebkitOverflowScrolling: 'touch' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 16px' }}>📭</p>
            <p style={{ color: SUBLABEL, ...F }}>Keine Aufträge für diesen Tag.</p>
          </div>
        ) : (
          <Card>
            {filtered.map((a, i) => {
              const running = timelogs.find(t => t.assignment_id === a.id && !t.end_time);
              return (
                <ListItem key={a.id} last={i === filtered.length - 1}
                  primary={a.title}
                  secondary={`${clock(a.scheduled_at)} · ${a.customer?.first_name} ${a.customer?.last_name}${running ? ' · ⏱ läuft' : ''}`}
                  right={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc(a.status) }} />
                      <span style={{ color: SEP, fontSize: '1.2rem' }}>›</span>
                    </div>
                  }
                  onPress={() => onSelect(a)}
                />
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Kunden (customer list) ─────────────────────────────────────────────────────

function KundenScreen({ assignments, reports, onSelect }: {
  assignments: Assignment[]; reports: Report[];
  onSelect: (c: Customer, ca: Assignment[]) => void;
}) {
  const customerMap = useMemo(() => {
    const m = new Map<string, { customer: Customer; assignments: Assignment[] }>();
    assignments.forEach(a => {
      if (!a.customer) return;
      if (!m.has(a.customer.id)) m.set(a.customer.id, { customer: a.customer, assignments: [] });
      m.get(a.customer.id)!.assignments.push(a);
    });
    return Array.from(m.values()).sort((a, b) => a.customer.last_name.localeCompare(b.customer.last_name));
  }, [assignments]);

  const openCount = (cas: Assignment[]) => cas.filter(a => {
    if (a.status !== 'completed') return false;
    const rep = reports.find(r => r.assignment_id === a.id);
    return !rep?.signature_id;
  }).length;

  const [search, setSearch] = useState('');
  const filtered = customerMap.filter(({ customer: c }) => {
    const q = search.toLowerCase();
    return !q || c.first_name.toLowerCase().includes(q) || c.last_name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG }}>
      <div style={{ background: GREEN, paddingTop: 'env(safe-area-inset-top)', flexShrink: 0, padding: 'env(safe-area-inset-top) 16px 14px' }}>
        <h2 style={{ margin: '14px 0 12px', fontSize: '1.5rem', fontWeight: 800, color: 'white', ...F }}>Kunden</h2>
        <input type="search" placeholder="🔍  Suchen…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputSt, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '12px' }}
        />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', WebkitOverflowScrolling: 'touch' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: SUBLABEL, ...F }}>Keine Kunden gefunden.</div>
        ) : (
          <Card>
            {filtered.map(({ customer: c, assignments: ca }, i) => {
              const open = openCount(ca);
              return (
                <ListItem key={c.id} last={i === filtered.length - 1}
                  primary={`${c.first_name} ${c.last_name}`}
                  secondary={c.address}
                  right={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {open > 0 && <span style={{ background: '#FF3B30', color: 'white', fontSize: '0.72rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', ...F }}>{open} offen</span>}
                      <span style={{ color: SEP, fontSize: '1.2rem' }}>›</span>
                    </div>
                  }
                  onPress={() => onSelect(c, ca)}
                />
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Kunde Detail (assignments for one customer) ────────────────────────────────

function KundeDetailScreen({ customer, assignments, reports, onBack, onSelect }: {
  customer: Customer; assignments: Assignment[]; reports: Report[];
  onBack: () => void; onSelect: (a: Assignment) => void;
}) {
  const open = assignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
  const done = assignments.filter(a => a.status === 'completed');

  const invoiceStatus = (a: Assignment) => {
    const rep = reports.find(r => r.assignment_id === a.id);
    if (!rep) return { label: 'Kein Bericht', color: SUBLABEL };
    if (rep.signature_id) return { label: 'Bezahlt ✓', color: SUCCESS };
    return { label: 'Offene Rechnung', color: DANGER };
  };

  const Section = ({ title, items, emptyText }: { title: string; items: Assignment[]; emptyText: string }) => (
    <div style={{ marginBottom: '20px' }}>
      <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 700, color: SUBLABEL, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px', ...F }}>{title}</p>
      {items.length === 0 ? (
        <p style={{ color: SUBLABEL, fontSize: '0.88rem', padding: '0 4px', ...F }}>{emptyText}</p>
      ) : (
        <Card>
          {items.map((a, i) => {
            const inv = invoiceStatus(a);
            return (
              <ListItem key={a.id} last={i === items.length - 1}
                primary={a.title}
                secondary={`${dateLabel(a.scheduled_at)} ${clock(a.scheduled_at)}`}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: inv.color, ...F }}>{inv.label}</span>
                    <span style={{ color: SEP, fontSize: '1.2rem' }}>›</span>
                  </div>
                }
                onPress={() => onSelect(a)}
              />
            );
          })}
        </Card>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title={`${customer.first_name} ${customer.last_name}`} onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        <Card style={{ marginBottom: '20px' }}>
          <div style={{ padding: '14px 16px' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '1.05rem', color: LABEL, ...F }}>{customer.first_name} {customer.last_name}</p>
            <p style={{ margin: '0 0 4px', color: SUBLABEL, fontSize: '0.88rem', ...F }}>📍 {customer.address}</p>
            {customer.phone_number && <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.88rem', ...F }}>📞 {customer.phone_number}</p>}
          </div>
        </Card>
        <Section title="Aktuelle Aufträge" items={open} emptyText="Keine offenen Aufträge." />
        <Section title="Abgeschlossene Aufträge" items={done} emptyText="Noch keine abgeschlossenen Aufträge." />
      </div>
    </div>
  );
}

// ── Assignment Detail ──────────────────────────────────────────────────────────

function DetailScreen({ flow, onBack, onStart, onResume, onKundeNichtDa }: {
  flow: FlowState; onBack: () => void;
  onStart: (tl: Timelog) => void; onResume: (tl: Timelog) => void;
  onKundeNichtDa: () => void;
}) {
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const { assignment } = flow;

  useEffect(() => {
    fetch(`${API}/timelogs/my`, { headers: authHeaders() }).then(r => r.ok ? r.json() : []).then(setTimelogs);
  }, []);

  const running = timelogs.find(t => t.assignment_id === assignment.id && !t.end_time);

  const start = async () => {
    setBusy(true); setErr('');
    const r = await fetch(`${API}/timelogs/start`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignment.id }) });
    if (r.ok) {
      const tl = await r.json();
      if (assignment.status === 'pending') await fetch(`${API}/assignments/${assignment.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'in_progress' }) });
      onStart(tl);
    } else { const d = await r.json(); setErr(d.message || 'Fehler beim Starten'); }
    setBusy(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title={assignment.title} onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', WebkitOverflowScrolling: 'touch' }}>
        {err && <div style={{ background: '#FFF0F0', color: DANGER, padding: '12px', borderRadius: '12px', marginBottom: '14px', fontSize: '0.9rem', ...F }}>{err}</div>}
        <Card>
          <ListItem primary="Termin" secondary={`${dateLabel(assignment.scheduled_at)}, ${clock(assignment.scheduled_at)}`} last={!assignment.description} />
          {assignment.description && <ListItem primary="Aufgabe" secondary={assignment.description} last />}
        </Card>
        {assignment.customer && (
          <Card>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SEP}` }}>
              <p style={{ margin: '0 0 2px', fontWeight: 700, color: LABEL, ...F }}>{assignment.customer.first_name} {assignment.customer.last_name}</p>
              <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.88rem', ...F }}>{assignment.customer.address}</p>
            </div>
            {assignment.customer.phone_number && <ListItem primary="Telefon" secondary={assignment.customer.phone_number} last={!assignment.customer.address} />}
            <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(assignment.customer.address)}`, '_blank')}
              style={{ display: 'flex', padding: '13px 16px', background: 'none', border: 'none', color: GREEN, fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', width: '100%', ...F }}>
              📍 In Maps öffnen ↗
            </button>
          </Card>
        )}
        {running && (
          <div style={{ background: '#E9F9EE', border: '1px solid #34C759', borderRadius: '16px', padding: '16px', marginBottom: '14px' }}>
            <p style={{ margin: '0 0 10px', color: '#1C7B37', fontWeight: 700, ...F }}>⏱ Timer läuft</p>
            <Btn label="Zum laufenden Timer →" onClick={() => onResume(running)} />
          </div>
        )}
      </div>
      {!running && (
        <div style={{ padding: '14px 16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'white', borderTop: `1px solid ${SEP}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Btn label={busy ? 'Startet…' : '⏱ Auftrag starten'} onClick={start} disabled={busy} />
          <Btn label="👤 Kunde nicht da" onClick={onKundeNichtDa} variant="secondary" />
        </div>
      )}
    </div>
  );
}

// ── Kunde nicht da Screen ──────────────────────────────────────────────────────

function KundeNichtDaScreen({ flow, onBack, onDone }: {
  flow: FlowState; onBack: () => void; onDone: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { assignment } = flow;
    try {
      // Start + immediately stop a minimal timelog
      const startR = await fetch(`${API}/timelogs/start`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignment.id }) });
      if (!startR.ok) { setBusy(false); return; }
      const tl = await startR.json();
      const stopR = await fetch(`${API}/timelogs/stop`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ timelog_id: tl.id }) });
      const stoppedTl = stopR.ok ? await stopR.json() : tl;
      // Create report
      const fullNotes = ['Kundenbesuch: Niemand angetroffen.', notes.trim()].filter(Boolean).join('\n\n');
      await fetch(`${API}/reports`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignment.id, timelog_id: stoppedTl.id, notes: fullNotes }) });
    } finally { setBusy(false); onDone(); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title="Kunde nicht da" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        <Card style={{ background: '#FFF9E6', border: '1px solid #FFE08A' }}>
          <div style={{ padding: '14px 16px' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#92400E', ...F }}>👤 Kunde nicht angetroffen</p>
            <p style={{ margin: 0, color: '#92400E', fontSize: '0.88rem', ...F }}>{flow.assignment.customer?.first_name} {flow.assignment.customer?.last_name} · {flow.assignment.customer?.address}</p>
          </div>
        </Card>
        <Card>
          <div style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 600, color: LABEL, ...F }}>Zusätzliche Notizen (optional)</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="z.B. Klingel defekt, Nachbar informiert…"
              style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }} />
          </div>
        </Card>
        <p style={{ color: SUBLABEL, fontSize: '0.82rem', textAlign: 'center', ...F }}>Es werden keine Kosten berechnet.</p>
      </div>
      <div style={{ padding: '14px 16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'white', borderTop: `1px solid ${SEP}` }}>
        <Btn label={busy ? 'Speichert…' : '💾 Speichern & Zurück'} onClick={save} disabled={busy} />
      </div>
    </div>
  );
}

// ── Timer Screen ──────────────────────────────────────────────────────────────

function TimerScreen({ flow, onBack, onStop }: { flow: FlowState; onBack: () => void; onStop: (tl: Timelog) => void }) {
  const { assignment, timelog } = flow;
  const [ms, setMs] = useState(timelog ? elapsedMs(timelog.start_time, null) : 0);
  const [stopping, setStopping] = useState(false);
  useEffect(() => {
    if (!timelog) return;
    const tick = () => setMs(elapsedMs(timelog.start_time, null)); tick();
    const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, [timelog]);
  const stop = async () => {
    if (!timelog) return; setStopping(true);
    const r = await fetch(`${API}/timelogs/stop`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ timelog_id: timelog.id }) });
    if (r.ok) onStop(await r.json()); setStopping(false);
  };
  const mins = Math.floor(ms / 60000);
  const price = calcPrice(mins);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return (
    <div style={{ minHeight: '100dvh', background: GREEN, display: 'flex', flexDirection: 'column', ...F, paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <span style={{ flex: 1, textAlign: 'center', color: 'white', fontWeight: 700 }}>Timer läuft</span>
        <div style={{ width: '40px' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0 0 4px', ...F }}>{assignment.title}</p>
        {assignment.customer && <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 48px', fontSize: '0.9rem', ...F }}>👤 {assignment.customer.first_name} {assignment.customer.last_name}</p>}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2px', marginBottom: '8px' }}>
          {h > 0 && <><span style={{ fontSize: '5rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>{pad(h)}</span><span style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>:</span></>}
          <span style={{ fontSize: '5rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>{pad(m)}</span>
          <span style={{ fontSize: '2.5rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>:</span>
          <span style={{ fontSize: '5rem', fontWeight: 800, color: 'white', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-2px' }}>{pad(s)}</span>
        </div>
        {timelog && <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', letterSpacing: '0.08em', margin: '0 0 48px', textTransform: 'uppercase' }}>Start {clock(timelog.start_time)}</p>}
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px 32px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bisherige Kosten</p>
          <p style={{ margin: 0, color: 'white', fontSize: '2rem', fontWeight: 800 }}>{euro(price)}</p>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>{priceBreakdown(mins)}</p>
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

function BerichtScreen({ flow, onBack, onNext }: { flow: FlowState; onBack: () => void; onNext: (notes: string) => void }) {
  const [notes, setNotes] = useState(flow.notes);
  const { assignment, timelog } = flow;
  const mins = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const price = calcPrice(mins);
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title="Bericht" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        <Card>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${SEP}` }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, color: LABEL, ...F }}>{assignment.customer?.first_name} {assignment.customer?.last_name}</p>
            <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.88rem', ...F }}>{assignment.customer?.address}</p>
          </div>
          {timelog && <ListItem primary="Arbeitszeit" secondary={`${clock(timelog.start_time)} – ${timelog.end_time ? clock(timelog.end_time) : '?'} (${mins} Min)`} last />}
        </Card>
        <Card>
          <div style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 10px', fontWeight: 600, color: LABEL, ...F }}>Was wurde erledigt?</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6} placeholder="Beschreibung der Arbeiten…" style={{ ...inputSt, resize: 'vertical', minHeight: '120px', lineHeight: 1.55 }} autoFocus />
          </div>
        </Card>
        <div style={{ background: GREEN_LIGHT, borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px', color: '#004A4A', fontWeight: 600, fontSize: '0.9rem', ...F }}>Betrag</p>
            <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.75rem', ...F }}>{priceBreakdown(mins)}</p>
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: GREEN, ...F }}>{euro(price)}</span>
        </div>
      </div>
      <div style={{ padding: '14px 16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'white', borderTop: `1px solid ${SEP}` }}>
        <Btn label="Weiter zur Zusammenfassung →" onClick={() => { if (notes.trim()) onNext(notes); }} disabled={!notes.trim()} />
      </div>
    </div>
  );
}

// ── Signature Canvas ───────────────────────────────────────────────────────────

function SigCanvas({ onSave }: { onSave: (url: string) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const dr = useRef(false);
  const [has, setHas] = useState(false);
  const xy = (e: React.TouchEvent | React.MouseEvent, c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect(); const sx = c.width / r.width, sy = c.height / r.height;
    if ('touches' in e) return { x: (e.touches[0].clientX - r.left) * sx, y: (e.touches[0].clientY - r.top) * sy };
    const m = e as React.MouseEvent; return { x: (m.clientX - r.left) * sx, y: (m.clientY - r.top) * sy };
  };
  const start = (e: React.TouchEvent | React.MouseEvent) => { e.preventDefault(); const c = cv.current!, ctx = c.getContext('2d')!, p = xy(e, c); ctx.beginPath(); ctx.moveTo(p.x, p.y); dr.current = true; };
  const draw = (e: React.TouchEvent | React.MouseEvent) => { e.preventDefault(); if (!dr.current) return; const c = cv.current!, ctx = c.getContext('2d')!; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; const p = xy(e, c); ctx.lineTo(p.x, p.y); ctx.stroke(); setHas(true); };
  const end = () => { dr.current = false; };
  const clear = () => { cv.current!.getContext('2d')!.clearRect(0, 0, 640, 200); setHas(false); };
  return (
    <div>
      <canvas ref={cv} width={640} height={200} style={{ width: '100%', height: '120px', border: `1.5px dashed ${SEP}`, borderRadius: '12px', background: '#FAFAFA', touchAction: 'none', cursor: 'crosshair', display: 'block' }}
        onMouseDown={start} onMouseMove={draw} onMouseUp={end} onMouseLeave={end} onTouchStart={start} onTouchMove={draw} onTouchEnd={end} />
      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button style={{ flex: 1, padding: '10px', background: 'white', border: `1px solid ${SEP}`, borderRadius: '10px', color: LABEL, cursor: 'pointer', ...F }} onClick={clear}>Löschen</button>
        <button style={{ flex: 2, padding: '10px', background: has ? GREEN : '#C7C7CC', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: has ? 'pointer' : 'not-allowed', ...F }} disabled={!has}
          onClick={() => has && onSave(cv.current!.toDataURL('image/png'))}>
          ✓ Übernehmen
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
  const [signer, setSigner] = useState(assignment.customer ? `${assignment.customer.first_name} ${assignment.customer.last_name}` : '');
  const [sig, setSig] = useState(flow.signatureData);
  const [reportId, setReportId] = useState(flow.reportId);
  const [creating, setCreating] = useState(!flow.reportId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const mins = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const price = calcPrice(mins);

  useEffect(() => {
    if (reportId || !timelog?.end_time) return;
    (async () => {
      setCreating(true);
      const r = await fetch(`${API}/reports`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ assignment_id: assignment.id, timelog_id: timelog.id, notes }) });
      if (r.ok) { setReportId((await r.json()).id); }
      else if (r.status === 409) {
        const all = await fetch(`${API}/reports/my`, { headers: authHeaders() });
        if (all.ok) { const found = (await all.json() as Report[]).find(x => x.timelog_id === timelog.id); if (found) setReportId(found.id); }
      }
      setCreating(false);
    })();
  }, []);

  const sign = async () => {
    if (!sig || !signer.trim()) { setErr('Bitte Unterschrift und Name eintragen.'); return; }
    if (!reportId) { setErr('Bericht wird erstellt, bitte warten…'); return; }
    setSaving(true); setErr('');
    const r = await fetch(`${API}/signatures`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ report_id: reportId, image_data: sig, signer_name: signer }) });
    if (r.ok) { onSigned(signer, sig, reportId); }
    else { const d = await r.json(); setErr(d.message || 'Fehler beim Speichern.'); }
    setSaving(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title="Zusammenfassung" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        {err && <div style={{ background: '#FFF0F0', color: DANGER, padding: '12px', borderRadius: '12px', marginBottom: '14px', fontSize: '0.9rem', ...F }}>{err}</div>}
        <div style={{ background: CARD, borderRadius: '20px', padding: '20px', marginBottom: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '34px', height: '34px', background: GREEN, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo.png" alt="" style={{ height: '20px', filter: 'brightness(0) invert(1)' }} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: LABEL, ...F }}>Helferchen</p>
              <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.75rem', ...F }}>Arbeitsnachweis</p>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${BG}`, paddingTop: '12px', marginBottom: '12px' }}>
            <p style={{ margin: '0 0 2px', fontWeight: 700, color: LABEL, ...F }}>{assignment.customer?.first_name} {assignment.customer?.last_name}</p>
            <p style={{ margin: 0, color: SUBLABEL, fontSize: '0.85rem', ...F }}>{assignment.customer?.address}</p>
          </div>
          <div style={{ background: BG, borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.84rem', color: SUBLABEL, ...F }}>Service</span>
              <span style={{ fontSize: '0.84rem', color: LABEL, fontWeight: 500, ...F }}>{assignment.title}</span>
            </div>
            {timelog && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.84rem', color: SUBLABEL, ...F }}>Arbeitszeit</span>
              <span style={{ fontSize: '0.84rem', color: LABEL, fontWeight: 500, ...F }}>{clock(timelog.start_time)} – {timelog.end_time ? clock(timelog.end_time) : '?'} ({mins} Min)</span>
            </div>}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.84rem', color: SUBLABEL, ...F }}>Abrechnung</span>
              <span style={{ fontSize: '0.84rem', color: LABEL, fontWeight: 500, ...F }}>{priceBreakdown(mins)}</span>
            </div>
          </div>
          {notes && (
            <div style={{ borderTop: `1px solid ${BG}`, paddingTop: '10px', marginBottom: '12px' }}>
              <p style={{ margin: '0 0 5px', fontSize: '0.72rem', color: SUBLABEL, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', ...F }}>Bericht</p>
              <p style={{ margin: 0, color: LABEL, fontSize: '0.88rem', lineHeight: 1.55, ...F }}>{notes}</p>
            </div>
          )}
          <div style={{ borderTop: '2px solid ' + LABEL, paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: LABEL, ...F }}>Gesamtbetrag</span>
            <span style={{ fontWeight: 800, fontSize: '1.8rem', color: GREEN, ...F }}>{euro(price)}</span>
          </div>
        </div>
        <Card>
          <div style={{ padding: '16px' }}>
            <p style={{ margin: '0 0 12px', fontWeight: 700, color: LABEL, ...F }}>Unterschrift des Kunden</p>
            <div style={{ marginBottom: '12px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '0.75rem', fontWeight: 600, color: SUBLABEL, textTransform: 'uppercase', ...F }}>Name</p>
              <input type="text" value={signer} onChange={e => setSigner(e.target.value)} style={inputSt} />
            </div>
            <SigCanvas onSave={d => setSig(d)} />
            {sig && <div style={{ marginTop: '10px', padding: '10px', background: BG, borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: SUCCESS }}>✓</span><img src={sig} alt="" style={{ height: '36px' }} />
            </div>}
          </div>
        </Card>
      </div>
      <div style={{ padding: '14px 16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'white', borderTop: `1px solid ${SEP}` }}>
        <Btn label={saving ? 'Speichert…' : creating ? 'Wird erstellt…' : 'Weiter zur Zahlung →'}
          onClick={sign} disabled={saving || creating || !sig || !signer.trim()} />
      </div>
    </div>
  );
}

// ── Zahlung Screen ─────────────────────────────────────────────────────────────

function ZahlungScreen({ flow, onBack, onDone, onEmail }: {
  flow: FlowState; onBack: () => void;
  onDone: (m: 'bar' | 'saved') => void;
  onEmail: (m: 'bar' | 'saved') => void;
}) {
  const { timelog } = flow;
  const mins = timelog ? calcMinutes(timelog.start_time, timelog.end_time) : 0;
  const basePrice = calcPrice(mins);
  const [selected, setSelected] = useState<'bar' | 'saved' | null>(null);

  const [voucherCode, setVoucherCode] = useState('');
  const [voucherStatus, setVoucherStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [voucherLabel, setVoucherLabel] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherErr, setVoucherErr] = useState('');

  const finalPrice = Math.max(0, basePrice - voucherDiscount);

  const checkVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherStatus('checking');
    setVoucherErr('');
    try {
      const res = await fetch(`${API}/vouchers/validate`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code: voucherCode.trim().toUpperCase(), gross_amount: basePrice }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setVoucherStatus('invalid');
        setVoucherErr(data.message || 'Ungültiger Code');
        setVoucherDiscount(0);
        setVoucherLabel('');
      } else {
        setVoucherStatus('valid');
        setVoucherDiscount(data.discount_amount);
        setVoucherLabel(data.voucher.label);
        setVoucherErr('');
      }
    } catch {
      setVoucherStatus('invalid');
      setVoucherErr('Verbindungsfehler');
    }
  };

  const removeVoucher = () => {
    setVoucherCode(''); setVoucherStatus('idle');
    setVoucherDiscount(0); setVoucherLabel(''); setVoucherErr('');
  };

  const applyVoucherToReport = async () => {
    if (voucherStatus !== 'valid' || !flow.reportId) return;
    try {
      await fetch(`${API}/vouchers/apply`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code: voucherCode.trim().toUpperCase(), report_id: flow.reportId, gross_amount: basePrice }),
      });
    } catch { /* non-blocking */ }
  };

  const handleSelect = async (method: 'bar' | 'saved') => {
    if (voucherStatus === 'valid') await applyVoucherToReport();
    setSelected(method);
  };

  const handlePrint = async () => {
    if (flow.reportId) await downloadPdfBlob(flow.reportId);
    onDone(selected!);
  };

  if (selected !== null) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
        <NavBar title="Zahlung" onBack={() => setSelected(null)} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ background: '#E9F9EE', border: '1px solid #34C759', borderRadius: '16px', padding: '18px', marginBottom: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>{selected === 'bar' ? '✅' : '💾'}</div>
            <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#1C7B37', fontSize: '1.05rem', ...F }}>
              {selected === 'bar' ? `Bar bezahlt · ${euro(finalPrice)}` : 'Zwischengespeichert'}
            </p>
            {voucherDiscount > 0 && (
              <p style={{ margin: '2px 0 0', color: '#2D9448', fontSize: '0.82rem', ...F }}>
                Gutschein: {voucherLabel} (−{euro(voucherDiscount)})
              </p>
            )}
            <p style={{ margin: '4px 0 0', color: '#2D9448', fontSize: '0.84rem', ...F }}>
              {selected === 'bar' ? 'Zahlung erhalten' : 'Kunde zahlt später'}
            </p>
          </div>
          <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: '1.05rem', color: LABEL, ...F }}>Rechnung zustellen?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={handlePrint} style={{ padding: '20px 24px', background: CARD, color: LABEL, border: `1.5px solid ${SEP}`, borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', width: '100%', ...F }}>
              <span style={{ fontSize: '2.2rem', flexShrink: 0 }}>🖨️</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1.02rem', color: LABEL, ...F }}>Rechnung drucken</p>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: SUBLABEL, ...F }}>PDF öffnen und über den Drucker ausgeben</p>
              </div>
              <span style={{ marginLeft: 'auto', color: SEP, fontSize: '1.2rem' }}>›</span>
            </button>
            <button onClick={() => onEmail(selected)} style={{ padding: '20px 24px', background: CARD, color: LABEL, border: `1.5px solid ${SEP}`, borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', textAlign: 'left', width: '100%', ...F }}>
              <span style={{ fontSize: '2.2rem', flexShrink: 0 }}>📧</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1.02rem', color: LABEL, ...F }}>Per E-Mail versenden</p>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: SUBLABEL, ...F }}>Rechnung als PDF an den Kunden schicken</p>
              </div>
              <span style={{ marginLeft: 'auto', color: SEP, fontSize: '1.2rem' }}>›</span>
            </button>
          </div>
        </div>
        <div style={{ padding: '14px 16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', background: 'white', borderTop: `1px solid ${SEP}` }}>
          <Btn label="Überspringen →" onClick={() => onDone(selected)} variant="ghost" />
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title="Zahlung" onBack={onBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ width: '72px', height: '72px', background: GREEN_LIGHT, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <span style={{ fontSize: '2.2rem' }}>💶</span>
          </div>
          <p style={{ margin: '0 0 5px', color: SUBLABEL, ...F }}>Offener Betrag</p>
          {voucherDiscount > 0 ? (
            <>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: SUBLABEL, textDecoration: 'line-through', ...F }}>{euro(basePrice)}</p>
              <p style={{ margin: '2px 0 0', fontSize: '2.8rem', fontWeight: 800, color: '#16a34a', ...F }}>{euro(finalPrice)}</p>
              <p style={{ margin: '4px 0 0', color: '#16a34a', fontSize: '0.82rem', fontWeight: 600, ...F }}>
                🎟 {voucherLabel} · −{euro(voucherDiscount)}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '2.8rem', fontWeight: 800, color: LABEL, ...F }}>{euro(basePrice)}</p>
          )}
          <p style={{ margin: '5px 0 0', color: SUBLABEL, fontSize: '0.8rem', ...F }}>{mins} Min · {priceBreakdown(mins)}</p>
        </div>

        {/* Voucher input */}
        <div style={{ background: CARD, borderRadius: '16px', padding: '14px 16px', marginBottom: '16px' }}>
          <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: '0.9rem', color: LABEL, ...F }}>Gutscheincode</p>
          {voucherStatus === 'valid' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f0fdf4', borderRadius: '10px', padding: '10px 12px' }}>
              <span style={{ fontSize: '1.4rem' }}>🎟</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#15803d', fontSize: '0.95rem', ...F }}>{voucherCode.toUpperCase()}</p>
                <p style={{ margin: '2px 0 0', color: '#16a34a', fontSize: '0.8rem', ...F }}>{voucherLabel} · −{euro(voucherDiscount)}</p>
              </div>
              <button onClick={removeVoucher} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '1.2rem', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={voucherCode}
                onChange={e => { setVoucherCode(e.target.value.toUpperCase()); if (voucherStatus !== 'idle') { setVoucherStatus('idle'); setVoucherErr(''); } }}
                onKeyDown={e => e.key === 'Enter' && checkVoucher()}
                placeholder="z.B. HELF-A3X7-K2P9"
                style={{ flex: 1, padding: '10px 12px', border: `1.5px solid ${voucherStatus === 'invalid' ? '#ef4444' : SEP}`, borderRadius: '10px', fontSize: '0.9rem', fontFamily: 'monospace', textTransform: 'uppercase', outline: 'none', ...F }}
              />
              <button
                onClick={checkVoucher}
                disabled={!voucherCode.trim() || voucherStatus === 'checking'}
                style={{ padding: '10px 16px', background: voucherCode.trim() ? GREEN : '#e5e7eb', color: voucherCode.trim() ? 'white' : '#9ca3af', border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, cursor: voucherCode.trim() ? 'pointer' : 'default', ...F }}
              >
                {voucherStatus === 'checking' ? '…' : 'Prüfen'}
              </button>
            </div>
          )}
          {voucherErr && <p style={{ margin: '6px 0 0', color: '#ef4444', fontSize: '0.82rem', ...F }}>{voucherErr}</p>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => handleSelect('bar')} style={{ padding: '20px 24px', background: GREEN, color: 'white', border: 'none', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', ...F }}>
            <span style={{ fontSize: '2rem' }}>💵</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>Bar bezahlt</p>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.75 }}>Auftrag abschließen · {euro(finalPrice)}</p>
            </div>
          </button>
          <button disabled style={{ padding: '20px 24px', background: BG, color: '#C7C7CC', border: 'none', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'not-allowed', ...F }}>
            <span style={{ fontSize: '2rem', opacity: 0.4 }}>💳</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: 700 }}>Mit Karte</p>
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Demnächst</p>
            </div>
          </button>
          <button onClick={() => handleSelect('saved')} style={{ padding: '18px 24px', background: CARD, color: LABEL, border: `1.5px solid ${SEP}`, borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', ...F }}>
            <span style={{ fontSize: '2rem' }}>💾</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>Zwischenspeichern</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: SUBLABEL }}>Kunde zahlt später</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quittung Screen (E-Mail) ───────────────────────────────────────────────────

function QuittungScreen({ flow, onDone }: { flow: FlowState; onDone: () => void }) {
  const [emailAddr, setEmailAddr] = useState(flow.assignment.customer?.email || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  const sendEmail = async () => {
    if (!emailAddr.trim() || !flow.reportId) return;
    setSending(true); setErr('');
    const r = await fetch(`${API}/pdf/${flow.reportId}/email`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ to: emailAddr.trim() }) });
    setSending(false);
    if (r.ok) setSent(true);
    else setErr('E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <NavBar title="Rechnung per E-Mail" onBack={onDone} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
        {sent ? (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: LABEL, ...F }}>E-Mail gesendet!</h2>
            <p style={{ color: SUBLABEL, marginBottom: '32px', ...F }}>Die Rechnung wurde an<br/><strong>{emailAddr}</strong> gesendet.</p>
            <Btn label="Fertig" onClick={onDone} />
          </div>
        ) : (
          <>
            {err && <div style={{ background: '#FFF0F0', color: DANGER, padding: '12px', borderRadius: '12px', marginBottom: '14px', fontSize: '0.9rem', ...F }}>{err}</div>}
            <Card>
              <div style={{ padding: '16px' }}>
                <p style={{ margin: '0 0 10px', fontWeight: 700, color: LABEL, ...F }}>E-Mail-Adresse des Kunden</p>
                <input type="email" value={emailAddr} onChange={e => setEmailAddr(e.target.value)}
                  placeholder="kunde@example.com" style={{ ...inputSt, marginBottom: '14px' }} autoFocus />
                <Btn label={sending ? 'Wird gesendet…' : '📧 Rechnung senden'} onClick={sendEmail} disabled={sending || !emailAddr.trim()} />
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ── Abschluss Screen ───────────────────────────────────────────────────────────

function AbschlussScreen({ flow, onReset }: { flow: FlowState; onReset: () => void }) {
  const mins = flow.timelog ? calcMinutes(flow.timelog.start_time, flow.timelog.end_time) : 0;
  const price = calcPrice(mins);
  const msg = flow.kundeNichtDa ? '📝 Nicht angetroffen — gespeichert' : flow.savedWithoutPayment ? '💾 Gespeichert · Zahlung ausstehend' : `💵 Bar bezahlt · ${euro(price)}`;
  return (
    <div style={{ minHeight: '100dvh', background: GREEN, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', ...F, paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        <div style={{ fontSize: '5rem', marginBottom: '24px' }}>{flow.kundeNichtDa ? '📋' : '✅'}</div>
        <h2 style={{ color: 'white', fontSize: '1.8rem', fontWeight: 800, margin: '0 0 10px' }}>{flow.kundeNichtDa ? 'Gespeichert' : 'Fertig!'}</h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0 0 8px' }}>{flow.assignment.title}</p>
        <p style={{ color: 'rgba(255,255,255,0.55)', margin: '0 0 40px', fontSize: '0.9rem' }}>{msg}</p>
        <button onClick={onReset} style={{ padding: '16px 40px', background: 'white', color: GREEN, border: 'none', borderRadius: '16px', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', ...F }}>
          Zurück zu Aufträgen
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function MobileApp() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [screen, setScreen] = useState<Screen>('list');
  const [tab, setTab] = useState<Tab>('heute');
  const [flow, setFlow] = useState<FlowState | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ customer: Customer; assignments: Assignment[] } | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const refresh = useCallback(async () => {
    const [aR, tR, rR] = await Promise.all([
      fetch(`${API}/assignments/my`, { headers: authHeaders() }),
      fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
      fetch(`${API}/reports/my`, { headers: authHeaders() }),
    ]);
    if (aR.ok) setAssignments(await aR.json());
    if (tR.ok) setTimelogs(await tR.json());
    if (rR.ok) setReports(await rR.json());
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setChecking(false); return; }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(u => { setUser(u); refresh(); })
      .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); })
      .finally(() => setChecking(false));
  }, []);

  const upd = (patch: Partial<FlowState>) => setFlow(f => f ? { ...f, ...patch } : f);
  const reset = () => { setFlow(null); setSelectedCustomer(null); setScreen(tab === 'kunden' ? 'kunden' : tab === 'tour' ? 'tour' : 'list'); refresh(); };
  const logout = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); };

  const startFlow = (a: Assignment) => {
    setFlow({ assignment: a, timelog: null, notes: '', reportId: null, signatureData: '', signerName: '', paymentDone: false, savedWithoutPayment: false, kundeNichtDa: false });
    setScreen('detail');
  };

  if (checking) return <div style={{ minHeight: '100dvh', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: 'rgba(255,255,255,0.6)', ...F }}>Laden…</p></div>;
  if (!user) return <LoginScreen onLogin={u => { setUser(u); refresh(); }} />;

  // Full-screen screens (no shell)
  if (screen === 'timer' && flow) return <TimerScreen flow={flow} onBack={() => setScreen('detail')} onStop={tl => { upd({ timelog: tl }); setScreen('bericht'); }} />;
  if (screen === 'abschluss' && flow) return <AbschlussScreen flow={flow} onReset={reset} />;

  // Root tabs
  const onRootScreen = screen === 'list' || screen === 'tour' || screen === 'kunden';

  return (
    <div style={{ minHeight: '100dvh', maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', background: BG, ...F }}>
      {/* Logout button on root screens */}
      {onRootScreen && (
        <div style={{ position: 'absolute', top: 'env(safe-area-inset-top)', right: '16px', zIndex: 50, paddingTop: '10px' }}>
          <button onClick={logout} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '6px 12px', borderRadius: '16px', fontSize: '0.8rem', cursor: 'pointer', ...F }}>Abmelden</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {screen === 'list' && <HeuteScreen user={user} assignments={assignments} timelogs={timelogs} onSelect={startFlow} />}
        {screen === 'tour' && <TourScreen user={user} onRefresh={refresh} />}
        {screen === 'kunden' && <KundenScreen assignments={assignments} reports={reports} onSelect={(c, ca) => { setSelectedCustomer({ customer: c, assignments: ca }); setScreen('kunde_detail'); }} />}
        {screen === 'kunde_detail' && selectedCustomer && (
          <KundeDetailScreen customer={selectedCustomer.customer} assignments={selectedCustomer.assignments} reports={reports}
            onBack={() => setScreen('kunden')} onSelect={startFlow} />
        )}
        {screen === 'detail' && flow && (
          <DetailScreen flow={flow} onBack={() => { setFlow(null); setScreen(selectedCustomer ? 'kunde_detail' : 'list'); }}
            onStart={tl => { upd({ timelog: tl }); setScreen('timer'); }}
            onResume={tl => { upd({ timelog: tl }); setScreen('timer'); }}
            onKundeNichtDa={() => setScreen('kunde_nicht_da')}
          />
        )}
        {screen === 'kunde_nicht_da' && flow && (
          <KundeNichtDaScreen flow={flow} onBack={() => setScreen('detail')} onDone={() => { upd({ kundeNichtDa: true }); setScreen('abschluss'); }} />
        )}
        {screen === 'bericht' && flow && <BerichtScreen flow={flow} onBack={() => setScreen('detail')} onNext={notes => { upd({ notes }); setScreen('zusammenfassung'); }} />}
        {screen === 'zusammenfassung' && flow && <ZusammenfassungScreen flow={flow} onBack={() => setScreen('bericht')} onSigned={(s, d, r) => { upd({ signerName: s, signatureData: d, reportId: r }); setScreen('zahlung'); }} />}
        {screen === 'zahlung' && flow && (
          <ZahlungScreen flow={flow} onBack={() => setScreen('zusammenfassung')}
            onDone={m => {
              if (m === 'bar') fetch(`${API}/assignments/${flow.assignment.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'completed' }) });
              upd({ paymentDone: m === 'bar', savedWithoutPayment: m === 'saved' }); setScreen('abschluss');
            }}
            onEmail={m => {
              if (m === 'bar') fetch(`${API}/assignments/${flow.assignment.id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'completed' }) });
              upd({ paymentDone: m === 'bar', savedWithoutPayment: m === 'saved' }); setScreen('quittung');
            }}
          />
        )}
        {screen === 'quittung' && flow && (
          <QuittungScreen flow={flow} onDone={() => setScreen('abschluss')} />
        )}
      </div>

      {/* Bottom tab bar — only on root screens */}
      {onRootScreen && <TabBar active={tab} onChange={t => { setTab(t); setScreen(t === 'kunden' ? 'kunden' : t === 'tour' ? 'tour' : 'list'); }} />}
    </div>
  );
}
