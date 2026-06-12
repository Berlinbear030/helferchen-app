import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Overview from './Overview';
import Employees from './Employees';
import Reports from './Reports';
import AuditTrail from './AuditTrail';
import ExportPage from './ExportPage';
import FraudDetection from './FraudDetection';
import Settings from './Settings';
import Billing from './Billing';
import './admin.css';

const NAV = [
  { path: '', label: 'Übersicht' },
  { path: 'employees', label: 'Mitarbeiter' },
  { path: 'reports', label: 'Berichte' },
  { path: 'audit', label: 'Audit-Trail' },
  { path: 'export', label: 'Export' },
  { path: 'fraud', label: 'Betrugserkennung' },
  { path: 'settings', label: 'Einstellungen' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const deferredPrompt = useRef<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role !== 'admin') {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleInstallApp = async () => {
    if (deferredPrompt.current) {
      deferredPrompt.current.prompt();
      await deferredPrompt.current.userChoice;
      deferredPrompt.current = null;
    } else {
      alert('App ist bereits installiert oder öffne diese Seite im Browser und nutze "Zum Startbildschirm hinzufügen".');
    }
  };

  const handleOrderMarketing = () => {
    window.open('mailto:info@helferchen.info?subject=Werbematerial%20bestellen&body=Hallo%2C%0A%0Aich%20m%C3%B6chte%20Werbematerial%20bestellen.%0A%0AAnzahl%20und%20Art%3A%20', '_blank');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="admin-layout">
      {/* Mobile top bar */}
      <div className="admin-mobile-topbar">
        <button className="admin-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Menü öffnen">
          <span /><span /><span />
        </button>
        <img src="/logo_light.svg" alt="Helferchen" className="admin-mobile-logo" />
      </div>

      {/* Sidebar overlay backdrop */}
      {sidebarOpen && <div className="admin-sidebar-backdrop" onClick={closeSidebar} />}

      <aside className={`admin-sidebar${sidebarOpen ? ' admin-sidebar--open' : ''}`}>
        <div className="admin-sidebar-header">
          <img src="/logo_light.svg" alt="Helferchen Logo" style={{ width: '100%', marginBottom: '10px' }} />
          <span className="badge badge--admin">Admin Control</span>
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
                onClick={closeSidebar}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-actions">
          <button className="btn-sidebar-outline" onClick={handleInstallApp}>
            <span className="btn-icon">📱</span> App laden
          </button>
          <button className="btn-sidebar-outline" onClick={handleOrderMarketing}>
            <span className="btn-icon">🖨</span> Werbematerial bestellen
          </button>
          <button className="btn-sidebar-billing" onClick={() => { navigate('/admin/billing'); closeSidebar(); }}>
            Abrechnung
          </button>
        </div>
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
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<Billing />} />
        </Routes>
      </main>
    </div>
  );
}
