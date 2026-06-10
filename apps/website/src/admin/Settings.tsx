import { useEffect, useState } from 'react';
import { adminApi, Role } from './api';

const ALL_PERMISSIONS: { key: string; label: string }[] = [
  { key: 'view_assignments', label: 'Einsätze ansehen' },
  { key: 'manage_assignments', label: 'Einsätze erstellen/bearbeiten' },
  { key: 'reassign_assignments', label: 'Einsätze zuweisen/umstellen' },
  { key: 'view_customers', label: 'Kunden ansehen' },
  { key: 'manage_customers', label: 'Kunden verwalten' },
  { key: 'view_reports', label: 'Berichte ansehen' },
  { key: 'manage_reports', label: 'Berichte verwalten' },
  { key: 'view_timelogs', label: 'Zeiteinträge ansehen' },
  { key: 'view_audit', label: 'Audit-Trail ansehen' },
  { key: 'manage_users', label: 'Benutzer verwalten' },
  { key: 'view_booking_requests', label: 'Buchungsanfragen ansehen' },
  { key: 'manage_booking_requests', label: 'Buchungsanfragen bearbeiten' },
];

export default function Settings() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', display_name: '', permissions: [] as string[] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<{ display_name: string; permissions: string[] }>({ display_name: '', permissions: [] });
  const [submitting, setSubmitting] = useState(false);

  const load = () =>
    adminApi.getRoles().then(setRoles).catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const notify = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const togglePerm = (perm: string, current: string[], set: (p: string[]) => void) => {
    if (current.includes(perm)) set(current.filter(p => p !== perm));
    else set([...current, perm]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await adminApi.createRole(newRole);
      setNewRole({ name: '', display_name: '', permissions: [] });
      setShowNewForm(false);
      await load();
      notify('Rolle erstellt');
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (role: Role) => {
    setEditingId(role.id);
    setEditState({ display_name: role.display_name, permissions: [...role.permissions] });
  };

  const handleSaveEdit = async (role: Role) => {
    setSubmitting(true);
    setError('');
    try {
      await adminApi.updateRole(role.id, editState);
      setEditingId(null);
      await load();
      notify('Rolle aktualisiert');
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Rolle "${role.display_name}" wirklich löschen?`)) return;
    setError('');
    try {
      await adminApi.deleteRole(role.id);
      await load();
      notify('Rolle gelöscht');
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Einstellungen</h2>
      </div>

      {error && <p className="error">{error}</p>}
      {success && <p style={{ color: 'var(--color-success, #16a34a)', fontWeight: 600 }}>{success}</p>}

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Rollenverwaltung</h3>
          <button className="btn-primary" onClick={() => setShowNewForm(!showNewForm)}>
            {showNewForm ? 'Abbrechen' : '+ Neue Rolle'}
          </button>
        </div>

        {showNewForm && (
          <form className="admin-form" onSubmit={handleCreate} style={{ marginBottom: '1.5rem' }}>
            <h4>Neue Rolle erstellen</h4>
            <div className="form-row">
              <label>Rollenname (intern) *</label>
              <input
                required
                placeholder="z.B. teamleiter"
                value={newRole.name}
                onChange={e => setNewRole({ ...newRole, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
              />
            </div>
            <div className="form-row">
              <label>Anzeigename *</label>
              <input
                required
                placeholder="z.B. Teamleiter"
                value={newRole.display_name}
                onChange={e => setNewRole({ ...newRole, display_name: e.target.value })}
              />
            </div>
            <div className="form-row">
              <label>Berechtigungen</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.25rem' }}>
                {ALL_PERMISSIONS.map(p => (
                  <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'normal' }}>
                    <input
                      type="checkbox"
                      checked={newRole.permissions.includes(p.key)}
                      onChange={() => togglePerm(p.key, newRole.permissions, perms => setNewRole({ ...newRole, permissions: perms }))}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Speichern...' : 'Anlegen'}
            </button>
          </form>
        )}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Anzeigename</th>
              <th>Rollenname</th>
              <th>Typ</th>
              <th>Berechtigungen</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role.id}>
                {editingId === role.id ? (
                  <>
                    <td>
                      <input
                        value={editState.display_name}
                        onChange={e => setEditState({ ...editState, display_name: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td><code>{role.name}</code></td>
                    <td>
                      {role.is_system
                        ? <span className="badge badge--admin">System</span>
                        : <span className="badge badge--employee">Benutzerdefiniert</span>}
                    </td>
                    <td>
                      {role.name === 'admin' ? (
                        <em style={{ color: '#999' }}>Alle Berechtigungen (unveränderlich)</em>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                          {ALL_PERMISSIONS.map(p => (
                            <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 'normal', fontSize: '0.85rem' }}>
                              <input
                                type="checkbox"
                                checked={editState.permissions.includes(p.key)}
                                onChange={() => togglePerm(p.key, editState.permissions, perms => setEditState({ ...editState, permissions: perms }))}
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-primary" onClick={() => handleSaveEdit(role)} disabled={submitting} style={{ marginRight: '0.5rem' }}>
                        Speichern
                      </button>
                      <button className="btn-danger-sm" onClick={() => setEditingId(null)}>Abbrechen</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td><strong>{role.display_name}</strong></td>
                    <td><code>{role.name}</code></td>
                    <td>
                      {role.is_system
                        ? <span className="badge badge--admin">System</span>
                        : <span className="badge badge--employee">Benutzerdefiniert</span>}
                    </td>
                    <td>
                      {role.name === 'admin'
                        ? <em style={{ color: '#999' }}>Alle Berechtigungen</em>
                        : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {role.permissions.length === 0
                              ? <em style={{ color: '#999' }}>Keine</em>
                              : role.permissions.map(p => {
                                const def = ALL_PERMISSIONS.find(x => x.key === p);
                                return (
                                  <span key={p} style={{ background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', padding: '2px 6px', fontSize: '0.8rem' }}>
                                    {def ? def.label : p}
                                  </span>
                                );
                              })}
                          </div>
                        )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn-primary"
                        style={{ marginRight: '0.5rem', padding: '4px 10px', fontSize: '0.85rem' }}
                        onClick={() => startEdit(role)}
                      >
                        Bearbeiten
                      </button>
                      {!role.is_system && (
                        <button className="btn-danger-sm" onClick={() => handleDelete(role)}>Löschen</button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
