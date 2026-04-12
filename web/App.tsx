// App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./src/contexts/AuthContext";
import { ThemeProvider } from "./src/contexts/ThemeProvider";
import { useAuth } from "./src/hooks/useAuth";
import { ToastProvider } from "./src/components/ui/Toast";
import "./index.css";
import Layout from "./src/components/Layout";
import { lazy, Suspense } from "react";
import { WorkspaceProvider } from "./src/contexts/WorkspaceProvider";
import { ErrorBoundary } from "./src/components/ui/ErrorBoundary/ErrorBoundary";
import ErrorMonitor from "./src/lib/ErrorMonitor";

const ChatContainer = lazy(() => import("./src/components/chat/ChatContainer"));
const ImageGenerator = lazy(() => import("./src/components/ImageGenerator"));
const VoiceTools = lazy(() => import("./src/components/VoiceTools"));
const ProfilePage = lazy(() => import("./src/pages/ProfilePage"));
const PlaygroundPage = lazy(() => import("./src/pages/PlaygroundPage"));
const DocumentUploader = lazy(() => import("./src/components/chat/DocumentUploader"));
const SecurityPage = lazy(() => import("./src/pages/SecurityPage"));
const LoginScreen = lazy(() => import("./src/components/auth/Login"));
const RegisterScreen = lazy(() => import("./src/components/auth/Register"));
const LandingPage = lazy(() => import("./src/pages/LandingPage"));
const PrivacyPolicy = lazy(() => import("./src/pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./src/pages/legal/TermsOfService"));
const BlazeSettingsPage = lazy(() => import("./src/pages/BlazeSettingsPage.tsx"));
const SettingsPage = lazy(() => import("./src/pages/SettingsPage.tsx"));

// ==============================
// 🔹 PRODUCT CONFIG (single source of truth)
// ==============================
const PRODUCT_NAME = "Xemora";
const PRODUCT_TAGLINE = "An intelligent AI workspace for chat, voice, and creation";

// Init Error Monitoring
ErrorMonitor.init();

// ==============================
// Loading Component
// ==============================
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950">
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 rounded-full animate-ping opacity-75"></div>
        <div className="relative w-16 h-16 bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-6 hover:rotate-0 transition-transform">
          <span className="text-3xl font-black text-slate-950/80 select-none">X</span>
        </div>
      </div>
      <div className="text-lg font-medium text-white">
        Loading {PRODUCT_NAME}...
      </div>
    </div>
  </div>
);

// ==============================
// Route Guards
// ==============================
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// AuthOnlyRoute - Only redirects unauthenticated users from login/register
// Does NOT redirect authenticated users from landing page
const AuthOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  // If already authenticated, redirect to dashboard instead of showing login/register
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

// ==============================
// Home Content
// ==============================
const HomeContent = () => (
  <section
    className="text-center py-16"
    aria-label={`${PRODUCT_NAME} overview`}
  >
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
      Welcome to {PRODUCT_NAME}
    </h1>
    <p className="text-gray-600 dark:text-gray-300 max-w-xl mx-auto">
      {PRODUCT_TAGLINE}. Choose a feature from the navigation to get started.
    </p>
  </section>
);

// ==============================
// App Routes
// ==============================
const AppRoutes = () => {
  const { user: authUser, token: authToken } = useAuth();

  const userInfo = authUser
    ? { id: authUser.id, username: authUser.name || authUser.email || "User" }
    : null;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Landing Page - Accessible to everyone, no redirects */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth Pages - Only redirect if ALREADY authenticated */}
        <Route
          path="/login"
          element={
            <AuthOnlyRoute>
              <LoginScreen />
            </AuthOnlyRoute>
          }
        />

        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/security-center" element={<SecurityPage />} />

        <Route
          path="/register"
          element={
            <AuthOnlyRoute>
              <RegisterScreen />
            </AuthOnlyRoute>
          }
        />

        {/* Protected App Workspace */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<HomeContent />} />

          <Route
            path="chat"
            element={
              userInfo ? (
                <ChatContainer
                  token={authToken || ""}
                  userInfo={userInfo}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route path="playground" element={<PlaygroundPage />} />
          <Route path="image" element={<ImageGenerator />} />
          <Route path="voice" element={<VoiceTools/>} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="blaze-settings" element={<BlazeSettingsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="document-uploader" element={<DocumentUploader />} />
          <Route path="security" element={<SecurityPage />} />
        </Route>

        {/* Catch-all: redirect to landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

// ==============================
// Main App
// ==============================
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          <AuthProvider>
            <WorkspaceProvider>
              <Router>
                <div className="App" data-product={PRODUCT_NAME}>
                  <AppRoutes />
                </div>
              </Router>
            </WorkspaceProvider>
          </AuthProvider>
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  );
}