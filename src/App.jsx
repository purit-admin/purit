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

// 로그인 필요 라우트 — 미인증 시 /login으로 리다이렉트
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* 공개 */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Company — 로그인 필요 */}
      <Route path="/company" element={<PrivateRoute><CL><CompanyDashboard /></CL></PrivateRoute>} />
      <Route path="/company/notifications" element={<PrivateRoute><CL><NotificationCenter role="company" /></CL></PrivateRoute>} />
      <Route path="/company/new" element={<PrivateRoute><CL><NewMission /></CL></PrivateRoute>} />
      <Route path="/company/results" element={<PrivateRoute><CL><Results /></CL></PrivateRoute>} />
      <Route path="/company/diagnosis" element={<PrivateRoute><CL><Diagnosis /></CL></PrivateRoute>} />
      <Route path="/company/preference" element={<PrivateRoute><CL><PreferenceTest /></CL></PrivateRoute>} />
      <Route path="/company/pricing-test" element={<PrivateRoute><CL><PricingTest /></CL></PrivateRoute>} />
      <Route path="/company/email-test" element={<PrivateRoute><CL><ColdEmailTest /></CL></PrivateRoute>} />
      <Route path="/company/templates" element={<PrivateRoute><CL><QuestionTemplates /></CL></PrivateRoute>} />
      <Route path="/company/icp" element={<PrivateRoute><CL><ICPResearch /></CL></PrivateRoute>} />
      <Route path="/company/icp-pulse" element={<PrivateRoute><CL><ICPPulse /></CL></PrivateRoute>} />
      <Route path="/company/brand" element={<PrivateRoute><CL><BrandTracking /></CL></PrivateRoute>} />
      <Route path="/company/report" element={<PrivateRoute><CL><AIReport /></CL></PrivateRoute>} />
      <Route path="/company/settings" element={<PrivateRoute><CL><AccountSettings /></CL></PrivateRoute>} />
      <Route path="/company/plans" element={<PrivateRoute><CL><PricingPage /></CL></PrivateRoute>} />

      {/* Panel — 로그인 필요 */}
      <Route path="/panel" element={<PrivateRoute><PL><PanelDashboard /></PL></PrivateRoute>} />
      <Route path="/panel/notifications" element={<PrivateRoute><PL><NotificationCenter role="panel" /></PL></PrivateRoute>} />
      <Route path="/panel/missions" element={<PrivateRoute><PL><MissionList /></PL></PrivateRoute>} />
      <Route path="/panel/active" element={<PrivateRoute><PL><ActiveMission /></PL></PrivateRoute>} />
      <Route path="/panel/history" element={<PrivateRoute><PL><History /></PL></PrivateRoute>} />
      <Route path="/panel/profile" element={<PrivateRoute><PL><PanelProfile /></PL></PrivateRoute>} />

      {/* Admin — 로그인 필요 */}
      <Route path="/admin" element={<PrivateRoute><AL><AdminDashboard /></AL></PrivateRoute>} />
      <Route path="/admin/notifications" element={<PrivateRoute><AL><NotificationCenter role="admin" /></AL></PrivateRoute>} />
      <Route path="/admin/panels" element={<PrivateRoute><AL><PanelManagement /></AL></PrivateRoute>} />
      <Route path="/admin/missions" element={<PrivateRoute><AL><AdminMissions /></AL></PrivateRoute>} />
      <Route path="/admin/purity" element={<PrivateRoute><AL><PurityFilter /></AL></PrivateRoute>} />
      <Route path="/admin/revenue" element={<PrivateRoute><AL><RevenueManagement /></AL></PrivateRoute>} />
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
