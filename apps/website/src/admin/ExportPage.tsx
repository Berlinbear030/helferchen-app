import { useState } from 'react';
import { adminApi } from './api';

function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(c => {
      const v = row[c];
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  );
  return [header, ...body].join('\n');
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const exportJSON = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.getExport();
      const json = JSON.stringify(data, null, 2);
      downloadFile(json, `helferchen-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const exportReportsCSV = async () => {
    setLoading(true);
    setError('');
    try {
      const reports = await adminApi.getReports();
      const rows = reports.map(r => ({
        id: r.id,
        kunde: r.customer?.name ?? '',
        start: r.timelog?.start_time ?? '',
        ende: r.timelog?.end_time ?? '',
        signiert: r.signature_id ? 'Ja' : 'Nein',
        pdf: r.pdf_generated ? 'Ja' : 'Nein',
        email: r.email_sent ? 'Ja' : 'Nein',
        erstellt: r.created_at,
      }));
      const csv = toCSV(rows, ['id', 'kunde', 'start', 'ende', 'signiert', 'pdf', 'email', 'erstellt']);
      downloadFile(csv, `berichte-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const exportUsersCSV = async () => {
    setLoading(true);
    setError('');
    try {
      const users = await adminApi.getUsers();
      const csv = toCSV(
        users.map(u => ({ id: u.id, username: u.username, name: u.full_name, rolle: u.role, email: u.email, erstellt: u.created_at })),
        ['id', 'username', 'name', 'rolle', 'email', 'erstellt']
      );
      downloadFile(csv, `mitarbeiter-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Export</h2>
      {error && <p className="error">{error}</p>}
      <div className="export-cards">
        <div className="export-card">
          <h3>Vollexport (JSON)</h3>
          <p>Alle Daten: Benutzer, Kunden, Einsätze, Zeiteinträge, Berichte (Signaturen geschwärzt)</p>
          <button className="btn-primary" onClick={exportJSON} disabled={loading}>
            JSON herunterladen
          </button>
        </div>
        <div className="export-card">
          <h3>Berichte (CSV)</h3>
          <p>Alle Berichte mit Zeitangaben, Kunden, Signatur- und E-Mail-Status</p>
          <button className="btn-primary" onClick={exportReportsCSV} disabled={loading}>
            CSV herunterladen
          </button>
        </div>
        <div className="export-card">
          <h3>Mitarbeiter (CSV)</h3>
          <p>Liste aller Benutzerkonten mit Rollen und Kontaktdaten</p>
          <button className="btn-primary" onClick={exportUsersCSV} disabled={loading}>
            CSV herunterladen
          </button>
        </div>
      </div>
    </div>
  );
}
