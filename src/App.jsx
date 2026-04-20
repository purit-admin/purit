import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Sidebar';
import NotificationCenter from './components/ui/NotificationCenter';

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/company" replace />} />

        {/* Company */}
        <Route path="/company" element={<CL><CompanyDashboard /></CL>} />
        <Route path="/company/notifications" element={<CL><NotificationCenter role="company" /></CL>} />
        <Route path="/company/new" element={<CL><NewMission /></CL>} />
        <Route path="/company/results" element={<CL><Results /></CL>} />
        <Route path="/company/diagnosis" element={<CL><Diagnosis /></CL>} />
        <Route path="/company/preference" element={<CL><PreferenceTest /></CL>} />
        <Route path="/company/pricing-test" element={<CL><PricingTest /></CL>} />
        <Route path="/company/email-test" element={<CL><ColdEmailTest /></CL>} />
        <Route path="/company/templates" element={<CL><QuestionTemplates /></CL>} />
        <Route path="/company/icp" element={<CL><ICPResearch /></CL>} />
        <Route path="/company/icp-pulse" element={<CL><ICPPulse /></CL>} />
        <Route path="/company/brand" element={<CL><BrandTracking /></CL>} />
        <Route path="/company/report" element={<CL><AIReport /></CL>} />
        <Route path="/company/settings" element={<CL><AccountSettings /></CL>} />
        <Route path="/company/plans" element={<CL><PricingPage /></CL>} />

        {/* Panel */}
        <Route path="/panel" element={<PL><PanelDashboard /></PL>} />
        <Route path="/panel/notifications" element={<PL><NotificationCenter role="panel" /></PL>} />
        <Route path="/panel/missions" element={<PL><MissionList /></PL>} />
        <Route path="/panel/active" element={<PL><ActiveMission /></PL>} />
        <Route path="/panel/history" element={<PL><History /></PL>} />
        <Route path="/panel/profile" element={<PL><PanelProfile /></PL>} />

        {/* Admin */}
        <Route path="/admin" element={<AL><AdminDashboard /></AL>} />
        <Route path="/admin/notifications" element={<AL><NotificationCenter role="admin" /></AL>} />
        <Route path="/admin/panels" element={<AL><PanelManagement /></AL>} />
        <Route path="/admin/missions" element={<AL><AdminMissions /></AL>} />
        <Route path="/admin/purity" element={<AL><PurityFilter /></AL>} />
        <Route path="/admin/revenue" element={<AL><RevenueManagement /></AL>} />
      </Routes>
    </BrowserRouter>
  );
}
