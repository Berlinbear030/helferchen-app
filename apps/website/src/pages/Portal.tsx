import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../index.css';

const API = 'http://localhost:3001/api';
const MAPS_API_KEY = (window as any).__GOOGLE_MAPS_KEY__ || '';

interface User {
  id: string;
  full_name: string;
  role: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  address: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  status: string;
  customer: Customer;
}

interface Timelog {
  id: string;
  assignment_id: string;
  start_time: string;
  end_time: string | null;
  is_signed: boolean;
}

type Tab = 'appointments' | 'map' | 'timelogs';

function authHeaders() {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Läuft…';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function MapView({ assignments }: { assignments: Assignment[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const [searchAddr, setSearchAddr] = useState('');
  const [mapsReady, setMapsReady] = useState(!!(window as any).google?.maps);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if ((window as any).google?.maps) {
      setMapsReady(true);
      return;
    }
    if (!MAPS_API_KEY) {
      setMapError('Kein Google Maps API-Schlüssel konfiguriert.');
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsReady(true);
    script.onerror = () => setMapError('Google Maps konnte nicht geladen werden.');
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 51.1657, lng: 10.4515 },
      zoom: 6,
    });
    mapInstance.current = map;

    const geocoder = new google.maps.Geocoder();
    assignments.forEach(a => {
      if (!a.customer?.address) return;
      geocoder.geocode({ address: a.customer.address }, (results: any, status: string) => {
        if (status !== 'OK' || !results[0]) return;
        const marker = new google.maps.Marker({
          position: results[0].geometry.location,
          map,
          title: `${a.title} — ${a.customer.first_name} ${a.customer.last_name}`,
        });
        const infoWindow = new google.maps.InfoWindow({
          content: `<strong>${a.title}</strong><br>${a.customer.address}<br>${new Date(a.scheduled_at).toLocaleString('de-DE')}`,
        });
        marker.addListener('click', () => infoWindow.open(map, marker));
      });
    });
  }, [mapsReady, assignments]);

  const handleSearch = useCallback(() => {
    if (!mapsReady || !mapInstance.current || !searchAddr.trim()) return;
    const google = (window as any).google;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchAddr }, (results: any, status: string) => {
      if (status === 'OK' && results[0]) {
        mapInstance.current!.setCenter(results[0].geometry.location);
        mapInstance.current!.setZoom(14);
      }
    });
  }, [mapsReady, searchAddr]);

  if (mapError) {
    return (
      <div className="map-placeholder">
        <p>{mapError}</p>
        <p>Termine mit Adressen:</p>
        <ul>
          {assignments.map(a => (
            <li key={a.id}><strong>{a.title}</strong>: {a.customer?.address}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div className="map-search-row">
        <input
          type="text"
          placeholder="Adresse suchen…"
          value={searchAddr}
          onChange={e => setSearchAddr(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="map-search-input"
        />
        <button onClick={handleSearch} className="btn-secondary">Suchen</button>
      </div>
      <div ref={mapRef} className="map-container" />
      {!mapsReady && <p className="loading-text">Karte wird geladen…</p>}
    </div>
  );
}

function AppointmentsView({ assignments, onRefresh }: { assignments: Assignment[]; onRefresh: () => void }) {
  const handleStatus = async (id: string, status: string) => {
    await fetch(`${API}/assignments/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    onRefresh();
  };

  const statusLabel: Record<string, string> = {
    pending: 'Ausstehend',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    cancelled: 'Abgebrochen',
  };

  return (
    <div className="appointments-list">
      {assignments.length === 0 && <p>Keine Termine zugewiesen.</p>}
      {assignments.map(a => (
        <div key={a.id} className={`appointment-card status-${a.status}`}>
          <div className="appointment-header">
            <strong>{a.title}</strong>
            <span className="status-badge">{statusLabel[a.status] || a.status}</span>
          </div>
          <p className="appointment-customer">
            {a.customer?.first_name} {a.customer?.last_name} — {a.customer?.address}
          </p>
          <p className="appointment-time">
            {new Date(a.scheduled_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
          {a.description && <p className="appointment-desc">{a.description}</p>}
          <div className="appointment-actions">
            {a.status === 'pending' && (
              <button className="btn-primary" onClick={() => handleStatus(a.id, 'in_progress')}>Starten</button>
            )}
            {a.status === 'in_progress' && (
              <button className="btn-success" onClick={() => handleStatus(a.id, 'completed')}>Abschließen</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelogsView({ timelogs, assignments }: { timelogs: Timelog[]; assignments: Assignment[] }) {
  const assignmentMap = Object.fromEntries(assignments.map(a => [a.id, a]));
  const sorted = [...timelogs].sort((a, b) =>
    new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
  );

  return (
    <div className="timelogs-list">
      {sorted.length === 0 && <p>Keine Zeiteinträge vorhanden.</p>}
      {sorted.map(t => {
        const a = assignmentMap[t.assignment_id];
        return (
          <div key={t.id} className={`timelog-entry ${!t.end_time ? 'timelog-active' : ''}`}>
            <div className="timelog-header">
              <span className="timelog-assignment">{a?.title || t.assignment_id}</span>
              {!t.end_time && <span className="timelog-running-badge">Aktiv</span>}
              {t.is_signed && <span className="timelog-signed-badge">Signiert</span>}
            </div>
            <div className="timelog-times">
              <span>Start: {new Date(t.start_time).toLocaleString('de-DE')}</span>
              {t.end_time && <span>Ende: {new Date(t.end_time).toLocaleString('de-DE')}</span>}
            </div>
            <div className="timelog-duration">
              Dauer: {formatDuration(t.start_time, t.end_time)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Portal() {
  const [user, setUser] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timelogs, setTimelogs] = useState<Timelog[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('appointments');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(userData));
  }, [navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, tRes] = await Promise.all([
        fetch(`${API}/assignments/my`, { headers: authHeaders() }),
        fetch(`${API}/timelogs/my`, { headers: authHeaders() }),
      ]);
      if (aRes.status === 401 || tRes.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }
      setAssignments(await aRes.json());
      setTimelogs(await tRes.json());
    } catch {
      setError('Fehler beim Laden der Daten. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  if (!user) return <div className="loading-screen">Laden…</div>;

  return (
    <div className="portal-layout">
      <header className="portal-header">
        <div className="portal-header-left">
          <span className="portal-logo">Helferchen</span>
          <span className="portal-user">Angemeldet als <strong>{user.full_name}</strong></span>
        </div>
        <button className="btn-logout" onClick={() => { localStorage.clear(); navigate('/'); }}>
          Abmelden
        </button>
      </header>

      <nav className="portal-tabs">
        <button
          className={`tab-btn ${activeTab === 'appointments' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          Termine
        </button>
        <button
          className={`tab-btn ${activeTab === 'map' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          Karte
        </button>
        <button
          className={`tab-btn ${activeTab === 'timelogs' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('timelogs')}
        >
          Zeiterfassung
        </button>
      </nav>

      <main className="portal-content">
        {error && <div className="error-banner">{error}</div>}
        {loading ? (
          <div className="loading-text">Daten werden geladen…</div>
        ) : (
          <>
            {activeTab === 'appointments' && (
              <AppointmentsView assignments={assignments} onRefresh={loadData} />
            )}
            {activeTab === 'map' && (
              <MapView assignments={assignments} />
            )}
            {activeTab === 'timelogs' && (
              <TimelogsView timelogs={timelogs} assignments={assignments} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
