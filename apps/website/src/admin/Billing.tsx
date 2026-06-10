import { useEffect, useState } from 'react';
import { adminApi, User } from './api';

export default function Billing() {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi.getUsers().then(setUsers).catch(e => setError(e.message));
  }, []);

  const activeEmployees = users.filter(u => u.role !== 'admin');

  return (
    <div>
      <h2>Abrechnung</h2>
      {error && <p className="error">{error}</p>}

      <div className="admin-stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value">{activeEmployees.length}</div>
          <div className="stat-label">Aktive Mitarbeiter</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>
            {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
          </div>
          <div className="stat-label">Abrechnungszeitraum</div>
        </div>
      </div>

      <section style={{ marginBottom: '2rem' }}>
        <h3>Mitarbeiter-Übersicht</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Benutzername</th>
              <th>Rolle</th>
              <th>E-Mail</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map(u => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{u.username}</td>
                <td><span className={`badge badge--${u.role}`}>{u.role}</span></td>
                <td>{u.email || '—'}</td>
                <td>
                  <button
                    className="btn-primary"
                    style={{ padding: '3px 10px', fontSize: '0.8rem' }}
                    onClick={() => window.open(`mailto:${u.email}?subject=Abrechnung%20${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`, '_blank')}
                  >
                    Abrechnung senden
                  </button>
                </td>
              </tr>
            ))}
            {activeEmployees.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999' }}>Keine Mitarbeiter gefunden</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Schnellaktionen</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => window.open(`mailto:?subject=Monatsabrechnung%20${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}&body=Bitte%20finden%20Sie%20anbei%20die%20Monatsabrechnung.`, '_blank')}
          >
            Sammelmail Abrechnung
          </button>
          <a href="/admin/export" className="btn-primary" style={{ textDecoration: 'none' }}>
            Daten exportieren
          </a>
          <a href="/admin/reports" className="btn-primary" style={{ textDecoration: 'none' }}>
            Berichte ansehen
          </a>
        </div>
      </section>
    </div>
  );
}
