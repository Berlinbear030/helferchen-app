import { useEffect, useState } from 'react';
import { adminApi, Report } from './api';

interface Anomaly {
  reportId: string;
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  customerId?: string;
  customerName?: string;
}

const LONG_SESSION_HOURS = 10;
const OVERNIGHT_START_HOUR = 22;
const OVERNIGHT_END_HOUR = 6;

function detectAnomalies(reports: Report[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const r of reports) {
    const tl = r.timelog;
    if (!tl || !tl.end_time) continue;

    const startMs = new Date(tl.start_time).getTime();
    const endMs = new Date(tl.end_time).getTime();
    const durationHours = (endMs - startMs) / 3600000;
    const startHour = new Date(tl.start_time).getHours();
    const endHour = new Date(tl.end_time).getHours();

    if (durationHours > LONG_SESSION_HOURS) {
      anomalies.push({
        reportId: r.id,
        type: 'Langer Einsatz',
        description: `Dauer: ${durationHours.toFixed(1)} Stunden (Grenze: ${LONG_SESSION_HOURS}h)`,
        severity: durationHours > 16 ? 'high' : 'medium',
        customerId: r.customer?.id,
        customerName: r.customer?.name,
      });
    }

    if (startHour >= OVERNIGHT_START_HOUR || startHour < OVERNIGHT_END_HOUR) {
      anomalies.push({
        reportId: r.id,
        type: 'Nachtschicht-Start',
        description: `Start um ${new Date(tl.start_time).toLocaleTimeString('de-DE')}`,
        severity: 'low',
        customerId: r.customer?.id,
        customerName: r.customer?.name,
      });
    }

    if (endHour >= OVERNIGHT_START_HOUR || endHour < OVERNIGHT_END_HOUR) {
      anomalies.push({
        reportId: r.id,
        type: 'Nachtschicht-Ende',
        description: `Ende um ${new Date(tl.end_time).toLocaleTimeString('de-DE')}`,
        severity: 'low',
        customerId: r.customer?.id,
        customerName: r.customer?.name,
      });
    }

    if (durationHours < 0.5 && durationHours > 0) {
      anomalies.push({
        reportId: r.id,
        type: 'Sehr kurzer Einsatz',
        description: `Dauer: ${Math.round(durationHours * 60)} Minuten`,
        severity: 'medium',
        customerId: r.customer?.id,
        customerName: r.customer?.name,
      });
    }
  }

  // Duplicate entries: same user+customer on same day
  const byUserCustomerDay = new Map<string, Report[]>();
  for (const r of reports) {
    if (!r.timelog) continue;
    const day = new Date(r.timelog.start_time).toDateString();
    const key = `${r.created_by_user_id}|${r.assignment_id}|${day}`;
    if (!byUserCustomerDay.has(key)) byUserCustomerDay.set(key, []);
    byUserCustomerDay.get(key)!.push(r);
  }
  for (const [, group] of byUserCustomerDay) {
    if (group.length > 1) {
      for (const r of group) {
        anomalies.push({
          reportId: r.id,
          type: 'Doppelter Einsatz',
          description: `${group.length} Einträge für denselben Einsatz am selben Tag`,
          severity: 'high',
          customerId: r.customer?.id,
          customerName: r.customer?.name,
        });
      }
    }
  }

  return anomalies;
}

const SEVERITY_LABEL: Record<string, string> = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };

export default function FraudDetection() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getReports()
      .then(reports => setAnomalies(detectAnomalies(reports)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Analysiere Zeitdaten...</p>;

  return (
    <div>
      <h2>Betrugserkennung</h2>
      <p style={{ color: '#666' }}>
        Automatische Erkennung von Auffälligkeiten in den Zeiterfassungsdaten.
      </p>
      {error && <p className="error">{error}</p>}
      {anomalies.length === 0 ? (
        <div className="fraud-ok">
          <span style={{ fontSize: '2rem' }}>✓</span>
          <p>Keine Auffälligkeiten gefunden.</p>
        </div>
      ) : (
        <>
          <p><strong>{anomalies.length} Auffälligkeit(en)</strong> gefunden</p>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Typ</th>
                <th>Schwere</th>
                <th>Beschreibung</th>
                <th>Kunde</th>
                <th>Bericht-ID</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a, i) => (
                <tr key={i}>
                  <td><strong>{a.type}</strong></td>
                  <td><span className={`badge badge--${a.severity}`}>{SEVERITY_LABEL[a.severity]}</span></td>
                  <td>{a.description}</td>
                  <td>{a.customerName ?? '—'}</td>
                  <td style={{ fontSize: '0.75rem', color: '#666' }}>{a.reportId.slice(-6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
