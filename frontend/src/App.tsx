import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Navigate } from 'react-router-dom';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { PageTransition } from "@/components/PageTransition";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Layout from "./pages/Layout";
import Dashboard from "./pages/Dashboard";
import StrategyList from "./pages/StrategyList";
import PlanList from "./pages/PlanList";
import DepartmentList from "./pages/DepartmentList";
import UserList from "./pages/UserList";
import AssessmentList from "./pages/AssessmentList";
import Profile from "./pages/Profile";
import WeeklyReportList from "./pages/WeeklyReportList";
import IssueList from "./pages/IssueList";
import DailyLog from "./pages/DailyLog";
import TaskManagement from "./pages/TaskManagement";
import AlignmentView from "./pages/AlignmentView";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { BrandProvider } from "@/contexts/BrandContext";

/**
 * Configure TanStack Query client with optimized defaults
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandProvider>
          <Toaster />
          <BrowserRouter>
            <AnimatedRoutes>
              {/* 公开路由 */}
            <Route 
              path="/login" 
              element={
                <PageTransition transition="fade">
                  <Login />
                </PageTransition>
              } 
            />
            
            {/* 受保护的路由 */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route 
                path="dashboard" 
                element={
                  <PageTransition transition="slide-fade">
                    <Dashboard />
                  </PageTransition>
                } 
              />
              <Route 
                path="strategy" 
                element={
                  <PageTransition transition="slide-fade">
                    <StrategyList />
                  </PageTransition>
                } 
              />
              <Route 
                path="plan" 
                element={
                  <PageTransition transition="slide-fade">
                    <PlanList />
                  </PageTransition>
                } 
              />
              <Route 
                path="department" 
                element={
                  <PageTransition transition="slide-fade">
                    <DepartmentList />
                  </PageTransition>
                } 
              />
              <Route 
                path="users" 
                element={
                  <PageTransition transition="slide-fade">
                    <UserList />
                  </PageTransition>
                } 
              />
              <Route 
                path="profile" 
                element={
                  <PageTransition transition="slide-fade">
                    <Profile />
                  </PageTransition>
                } 
              />
              <Route 
                path="assessment" 
                element={
                  <PageTransition transition="slide-fade">
                    <AssessmentList />
                  </PageTransition>
                } 
              />
              <Route 
                path="weekly-reports" 
                element={
                  <PageTransition transition="slide-fade">
                    <WeeklyReportList />
                  </PageTransition>
                } 
              />
              <Route 
                path="issues" 
                element={
                  <PageTransition transition="slide-fade">
                    <IssueList />
                  </PageTransition>
                } 
              />
              <Route 
                path="daily-log" 
                element={
                  <PageTransition transition="slide-fade">
                    <DailyLog />
                  </PageTransition>
                } 
              />
              <Route 
                path="tasks" 
                element={
                  <PageTransition transition="slide-fade">
                    <TaskManagement />
                  </PageTransition>
                } 
              />
              <Route 
                path="alignment" 
                element={
                  <PageTransition transition="slide-fade">
                    <AlignmentView />
                  </PageTransition>
                } 
              />
              <Route 
                path="settings" 
                element={
                  <PageTransition transition="slide-fade">
                    <SettingsPage />
                  </PageTransition>
                } 
              />
            </Route>
            
            {/* 404 */}
            <Route 
              path="*" 
              element={
                <PageTransition transition="fade">
                  <NotFound />
                </PageTransition>
              } 
            />
          </AnimatedRoutes>
        </BrowserRouter>
        </BrandProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
