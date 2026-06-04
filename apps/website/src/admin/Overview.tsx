import { useEffect, useState } from 'react';
import { adminApi, DashboardStats } from './api';

export default function Overview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getDashboard().then(setStats).catch(e => setError(e.message));
  }, []);

  if (error) return <p className="error">Fehler: {error}</p>;
  if (!stats) return <p>Laden...</p>;

  return (
    <div>
      <h2>Übersicht</h2>
      <div className="admin-stats-grid">
        <StatCard label="Benutzer" value={stats.total_users} />
        <StatCard label="Kunden" value={stats.total_customers} />
        <StatCard label="Einsätze" value={stats.total_assignments} />
        <StatCard label="Zeiteinträge" value={stats.total_timelogs} />
        <StatCard label="Aktive Timer" value={stats.active_timers} highlight={stats.active_timers > 0} />
        <StatCard label="Berichte" value={stats.total_reports} />
        <StatCard label="Signierte Berichte" value={stats.signed_reports} />
        <StatCard label="E-Mails versendet" value={stats.emails_sent} />
      </div>
      {Object.keys(stats.assignments_by_status).length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3>Einsätze nach Status</h3>
          <table className="admin-table">
            <thead><tr><th>Status</th><th>Anzahl</th></tr></thead>
            <tbody>
              {Object.entries(stats.assignments_by_status).map(([status, count]) => (
                <tr key={status}><td>{status}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`stat-card${highlight ? ' stat-card--highlight' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
