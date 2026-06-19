import { Routes, Route } from 'react-router-dom';
import PublicHome from './pages/PublicHome';
import Login from './pages/Login';
import Portal from './pages/Portal';
import Shop from './pages/Shop';
import MobileApp from './pages/MobileApp';
import AdminDashboard from './admin/AdminDashboard';
import Impressum from './pages/Impressum';

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/app" element={<MobileApp />} />
      <Route path="/werbeartikel" element={<Shop />} />
      <Route path="/admin/*" element={<AdminDashboard />} />
      <Route path="/impressum" element={<Impressum />} />
    </Routes>
  );
}

export default App;
