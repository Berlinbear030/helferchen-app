import { Routes, Route } from 'react-router-dom';
import PublicHome from './pages/PublicHome';
import Login from './pages/Login';
import Portal from './pages/Portal';
import AdminDashboard from './admin/AdminDashboard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/admin/*" element={<AdminDashboard />} />
    </Routes>
  );
}

export default App;
