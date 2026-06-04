import { useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Overview from './Overview';
import Employees from './Employees';
import Reports from './Reports';
import AuditTrail from './AuditTrail';
import ExportPage from './ExportPage';
import FraudDetection from './FraudDetection';
import './admin.css';

const NAV = [
  { path: '', label: 'Übersicht' },
  { path: 'employees', label: 'Mitarbeiter' },
  { path: 'reports', label: 'Berichte' },
  { path: 'audit', label: 'Audit-Trail' },
  { path: 'export', label: 'Export' },
  { path: 'fraud', label: 'Betrugserkennung' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h1>Helferchen</h1>
          <span className="badge badge--admin">Admin</span>
        </div>
        <nav className="admin-nav">
          {NAV.map(item => {
            const fullPath = `/admin/${item.path}`;
            const isActive = item.path === ''
              ? location.pathname === '/admin' || location.pathname === '/admin/'
              : location.pathname.startsWith(fullPath);
            return (
              <Link
                key={item.path}
                to={fullPath}
                className={`admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="btn-logout" onClick={handleLogout}>Abmelden</button>
        </div>
      </aside>
      <main className="admin-main">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="employees" element={<Employees />} />
          <Route path="reports" element={<Reports />} />
          <Route path="audit" element={<AuditTrail />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="fraud" element={<FraudDetection />} />
        </Routes>
      </main>
    </div>
  );
}
