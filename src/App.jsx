import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Sidebar';
import NotificationCenter from './components/ui/NotificationCenter';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Company pages
import CompanyDashboard from './pages/company/Dashboard';
import NewMission from './pages/company/NewMission';
import Results from './pages/company/Results';
import Diagnosis from './pages/company/Diagnosis';
import PreferenceTest from './pages/company/PreferenceTest';
import AIReport from './pages/company/AIReport';
import BrandTracking from './pages/company/BrandTracking';
import ICPResearch from './pages/company/ICPResearch';
import PricingTest from './pages/company/PricingTest';
import ColdEmailTest from './pages/company/ColdEmailTest';
import ICPPulse from './pages/company/ICPPulse';
import QuestionTemplates from './pages/company/QuestionTemplates';
import PricingPage from './pages/company/Pricing';
import AccountSettings from './pages/company/Settings';
import CompanyAccount from './pages/company/Account';
import AdminAccount from './pages/admin/Account';

// Panel pages
import PanelDashboard from './pages/panel/Dashboard';
import MissionList from './pages/panel/Missions';
import ActiveMission from './pages/panel/ActiveMission';
import History from './pages/panel/History';
import PanelProfile from './pages/panel/Profile';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminMissions from './pages/admin/Missions';
import PurityFilter from './pages/admin/PurityFilter';
import PanelManagement from './pages/admin/PanelManagement';
import RevenueManagement from './pages/admin/Revenue';

const CL = ({ children }) => <Layout role="company">{children}</Layout>;
const PL = ({ children }) => <Layout role="panel">{children}</Layout>;
const AL = ({ children }) => <Layout role="admin">{children}</Layout>;

const ROLE_HOME = { company: '/company', panel: '/panel', admin: '/admin' };

// 로그인 필요 + 역할 기반 접근 제어
function RoleRoute({ role: required, children }) {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // role 없으면 로그인으로
  if (!role) return <Navigate to="/login" replace />;
  // admin은 모든 포털 접근 허용, 다른 역할은 자기 포털로 리다이렉트
  if (role !== required && role !== 'admin') return <Navigate to={ROLE_HOME[role]} replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* 공개 */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Company — company 역할만 접근 가능 */}
      <Route path="/company" element={<RoleRoute role="company"><CL><CompanyDashboard /></CL></RoleRoute>} />
      <Route path="/company/notifications" element={<RoleRoute role="company"><CL><NotificationCenter role="company" /></CL></RoleRoute>} />
      <Route path="/company/new" element={<RoleRoute role="company"><CL><NewMission /></CL></RoleRoute>} />
      <Route path="/company/results" element={<RoleRoute role="company"><CL><Results /></CL></RoleRoute>} />
      <Route path="/company/diagnosis" element={<RoleRoute role="company"><CL><Diagnosis /></CL></RoleRoute>} />
      <Route path="/company/preference" element={<RoleRoute role="company"><CL><PreferenceTest /></CL></RoleRoute>} />
      <Route path="/company/pricing-test" element={<RoleRoute role="company"><CL><PricingTest /></CL></RoleRoute>} />
      <Route path="/company/email-test" element={<RoleRoute role="company"><CL><ColdEmailTest /></CL></RoleRoute>} />
      <Route path="/company/templates" element={<RoleRoute role="company"><CL><QuestionTemplates /></CL></RoleRoute>} />
      <Route path="/company/icp" element={<RoleRoute role="company"><CL><ICPResearch /></CL></RoleRoute>} />
      <Route path="/company/icp-pulse" element={<RoleRoute role="company"><CL><ICPPulse /></CL></RoleRoute>} />
      <Route path="/company/brand" element={<RoleRoute role="company"><CL><BrandTracking /></CL></RoleRoute>} />
      <Route path="/company/report" element={<RoleRoute role="company"><CL><AIReport /></CL></RoleRoute>} />
      <Route path="/company/account" element={<RoleRoute role="company"><CL><CompanyAccount /></CL></RoleRoute>} />
      <Route path="/company/settings" element={<RoleRoute role="company"><CL><AccountSettings /></CL></RoleRoute>} />
      <Route path="/company/plans" element={<RoleRoute role="company"><CL><PricingPage /></CL></RoleRoute>} />

      {/* Panel — panel 역할만 접근 가능 */}
      <Route path="/panel" element={<RoleRoute role="panel"><PL><PanelDashboard /></PL></RoleRoute>} />
      <Route path="/panel/notifications" element={<RoleRoute role="panel"><PL><NotificationCenter role="panel" /></PL></RoleRoute>} />
      <Route path="/panel/missions" element={<RoleRoute role="panel"><PL><MissionList /></PL></RoleRoute>} />
      <Route path="/panel/active" element={<RoleRoute role="panel"><PL><ActiveMission /></PL></RoleRoute>} />
      <Route path="/panel/history" element={<RoleRoute role="panel"><PL><History /></PL></RoleRoute>} />
      <Route path="/panel/profile" element={<RoleRoute role="panel"><PL><PanelProfile /></PL></RoleRoute>} />

      {/* Admin — admin 역할만 접근 가능 */}
      <Route path="/admin" element={<RoleRoute role="admin"><AL><AdminDashboard /></AL></RoleRoute>} />
      <Route path="/admin/notifications" element={<RoleRoute role="admin"><AL><NotificationCenter role="admin" /></AL></RoleRoute>} />
      <Route path="/admin/panels" element={<RoleRoute role="admin"><AL><PanelManagement /></AL></RoleRoute>} />
      <Route path="/admin/missions" element={<RoleRoute role="admin"><AL><AdminMissions /></AL></RoleRoute>} />
      <Route path="/admin/purity" element={<RoleRoute role="admin"><AL><PurityFilter /></AL></RoleRoute>} />
      <Route path="/admin/revenue" element={<RoleRoute role="admin"><AL><RevenueManagement /></AL></RoleRoute>} />
      <Route path="/admin/account" element={<RoleRoute role="admin"><AL><AdminAccount /></AL></RoleRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
