
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/common/Layout';
import DashboardPage from './pages/DashboardPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import CaravanesPage from './pages/CaravanesPage';
import ConsultationsPage from './pages/ConsultationsPage';
// AdminPage is being replaced by UserManagementPage as the main /admin route
// import AdminPage from './pages/AdminPage'; 
import NotFoundPage from './pages/NotFoundPage';
import LoginPage from './pages/LoginPage'; 
import ProtectedRoute from './components/common/ProtectedRoute'; 
import { useAuth } from './contexts/AuthContext';

// Placeholder Pages for Admin and actions
import UserManagementPage from './pages/admin/UserManagementPage'; // This will be the main /admin page
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
// import ReportsAnalyticsPage from './pages/admin/ReportsAnalyticsPage'; // Removed
// import AuditLogsPage from './pages/admin/AuditLogsPage'; // Removed
import PlanCaravanePage from './pages/caravanes/PlanCaravanePage';
import CaravaneDetailPage from './pages/caravanes/CaravaneDetailPage'; // Added
import EditCaravanePage from './pages/caravanes/EditCaravanePage'; // Added
import NewConsultationPage from './pages/consultations/NewConsultationPage';
import EditConsultationPage from './pages/consultations/EditConsultationPage'; // Re-enabled as file is provided
import HorsChampPage from './pages/HorsChampPage'; 


const App: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route 
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patients/:id" element={<PatientDetailPage />} />
                
                <Route path="/caravanes" element={<CaravanesPage />} />
                <Route path="/caravanes/plan" element={<PlanCaravanePage />} />
                <Route path="/caravanes/:id" element={<CaravaneDetailPage />} /> {/* Added route */}
                <Route path="/caravanes/edit/:id" element={<EditCaravanePage />} /> {/* Added route */}


                <Route path="/consultations" element={<ConsultationsPage />} />
                <Route path="/consultations/new" element={<NewConsultationPage />} /> 
                <Route path="/consultations/edit/:id" element={<EditConsultationPage />} /> {/* Re-enabled as file is provided */}

                <Route path="/patients-hors-champ" element={<HorsChampPage />} /> 
                
                <Route path="/admin" element={<UserManagementPage />} /> 
                <Route path="/admin/user-management" element={<UserManagementPage />} /> 
                <Route path="/admin/system-settings" element={<SystemSettingsPage />} /> 
                {/* Removed routes for reports and audit logs */}
                {/* <Route path="/admin/reports-analytics" element={<ReportsAnalyticsPage />} /> */}
                {/* <Route path="/admin/audit-logs" element={<AuditLogsPage />} /> */}


                <Route path="*" element={currentUser ? <NotFoundPage /> : <Navigate to="/login" replace />} /> 
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
