import { useEffect, useState } from 'react';
import { adminApi, User, Role } from './api';

export default function Employees() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'employee', email: '', full_name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');

  const load = () => Promise.all([
    adminApi.getUsers().then(setUsers),
    adminApi.getRoles().then(setRoles),
  ]).catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminApi.createUser(form);
      setForm({ username: '', password: '', role: 'employee', email: '', full_name: '' });
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Benutzer "${username}" wirklich löschen?`)) return;
    try {
      await adminApi.deleteUser(id);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const startRoleEdit = (u: User) => {
    setEditingRoleFor(u.id);
    setEditRole(u.role);
  };

  const handleSaveRole = async (u: User) => {
    try {
      await adminApi.updateUserRole(u.id, editRole);
      setEditingRoleFor(null);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const getRoleLabel = (roleName: string) => {
    const r = roles.find(r => r.name === roleName);
    return r ? r.display_name : roleName;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Mitarbeiter</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Abbrechen' : '+ Neu'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {showForm && (
        <form className="admin-form" onSubmit={handleCreate}>
          <h3>Neuen Benutzer anlegen</h3>
          <div className="form-row">
            <label>Benutzername *</label>
            <input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Passwort *</label>
            <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Rolle *</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {roles.map(r => (
                <option key={r.id} value={r.name}>{r.display_name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Vollständiger Name</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="form-row">
            <label>E-Mail</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Speichern...' : 'Anlegen'}
          </button>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Benutzername</th>
            <th>Rolle</th>
            <th>E-Mail</th>
            <th>Erstellt</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.full_name}</td>
              <td>{u.username}</td>
              <td>
                {editingRoleFor === u.id ? (
                  <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ padding: '2px 6px' }}>
                      {roles.map(r => (
                        <option key={r.id} value={r.name}>{r.display_name}</option>
                      ))}
                    </select>
                    <button className="btn-primary" style={{ padding: '2px 8px', fontSize: '0.8rem' }} onClick={() => handleSaveRole(u)}>OK</button>
                    <button className="btn-danger-sm" onClick={() => setEditingRoleFor(null)}>✕</button>
                  </span>
                ) : (
                  <span
                    className={`badge badge--${u.role}`}
                    title="Klicken zum Ändern"
                    style={{ cursor: 'pointer' }}
                    onClick={() => startRoleEdit(u)}
                  >
                    {getRoleLabel(u.role)}
                  </span>
                )}
              </td>
              <td>{u.email}</td>
              <td>{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
              <td>
                <button className="btn-danger-sm" onClick={() => handleDelete(u.id, u.username)}>
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
        Tipp: Auf die Rolle klicken, um sie zu ändern. Rollen werden unter Einstellungen verwaltet.
      </p>
    </div>
  );
}
