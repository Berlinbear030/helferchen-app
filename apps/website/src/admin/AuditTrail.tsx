import { useEffect, useState } from 'react';
import { adminApi, AuditEntry } from './api';

const ENTITY_TYPES = ['', 'user', 'report', 'timelog', 'signature', 'system'];

export default function AuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');
  const [entityType, setEntityType] = useState('');
  const [limit, setLimit] = useState(100);

  const load = () => {
    adminApi
      .getAudit({ entity_type: entityType || undefined, limit })
      .then(setEntries)
      .catch(e => setError(e.message));
  };

  useEffect(() => { load(); }, [entityType, limit]);

  return (
    <div>
      <h2>Audit-Trail</h2>
      {error && <p className="error">{error}</p>}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <select value={entityType} onChange={e => setEntityType(e.target.value)}>
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t || 'Alle Typen'}</option>)}
        </select>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
          <option value={50}>50 Einträge</option>
          <option value={100}>100 Einträge</option>
          <option value={500}>500 Einträge</option>
        </select>
      </div>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Zeitpunkt</th>
            <th>Typ</th>
            <th>Aktion</th>
            <th>Objekt-ID</th>
            <th>Benutzer</th>
            <th>Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id}>
              <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                {new Date(e.timestamp).toLocaleString('de-DE')}
              </td>
              <td><span className="badge badge--neutral">{e.entity_type}</span></td>
              <td>{e.action}</td>
              <td style={{ fontSize: '0.75rem', color: '#666' }}>{e.entity_id.slice(-8)}</td>
              <td style={{ fontSize: '0.75rem' }}>{e.performed_by.slice(-8)}</td>
              <td>{e.description}</td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>Keine Einträge</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
