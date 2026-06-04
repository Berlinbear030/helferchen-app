import { useEffect, useState } from 'react';
import { adminApi, Report } from './api';

function duration(start: string, end: string | null): string {
  if (!end) return 'läuft...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    adminApi.getReports().then(setReports).catch(e => setError(e.message));
  }, []);

  const filtered = filter
    ? reports.filter(r =>
        r.customer?.name?.toLowerCase().includes(filter.toLowerCase()) ||
        r.created_by_user_id.includes(filter)
      )
    : reports;

  return (
    <div>
      <h2>Berichte &amp; Zeiteinträge</h2>
      {error && <p className="error">{error}</p>}
      <input
        className="admin-search"
        placeholder="Nach Kunde oder Benutzer filtern..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Kunde</th>
            <th>Start</th>
            <th>Ende</th>
            <th>Dauer</th>
            <th>Signiert</th>
            <th>PDF</th>
            <th>E-Mail</th>
            <th>Erstellt</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.id}>
              <td style={{ fontSize: '0.75rem', color: '#666' }}>{r.id.slice(-6)}</td>
              <td>{r.customer?.name ?? '—'}</td>
              <td>{r.timelog ? new Date(r.timelog.start_time).toLocaleString('de-DE') : '—'}</td>
              <td>{r.timelog?.end_time ? new Date(r.timelog.end_time).toLocaleString('de-DE') : '—'}</td>
              <td>{r.timelog ? duration(r.timelog.start_time, r.timelog.end_time) : '—'}</td>
              <td>
                {r.signature_id
                  ? <span className="badge badge--success">✓ {r.signature?.signed_at ? new Date(r.signature.signed_at).toLocaleDateString('de-DE') : 'Ja'}</span>
                  : <span className="badge badge--neutral">Nein</span>}
              </td>
              <td>{r.pdf_generated ? '✓' : '—'}</td>
              <td>{r.email_sent ? '✓' : '—'}</td>
              <td>{new Date(r.created_at).toLocaleDateString('de-DE')}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: '#999' }}>Keine Berichte gefunden</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
