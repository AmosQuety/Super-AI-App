// App.tsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./src/contexts/AuthContext";
import { ThemeProvider } from "./src/contexts/ThemeProvider";
import { useAuth } from "./src/hooks/useAuth";
import { ToastProvider } from "./src/components/ui/Toast";
import Layout from "./src/components/Layout";
import LoginScreen from "./src/components/auth/Login";
import RegisterScreen from "./src/components/auth/Register";
import ChatContainer from "./src/components/chat/ChatContainer";
import VoiceScreen from "./src/pages/VoiceScreen";
import ImageGenerator from "./src/components/ImageGenerator";
import VoiceTools from "./src/components/VoiceTools";
import "./index.css";
import ProfilePage from "./src/pages/ProfilePage";
import PlaygroundPage from "./src/pages/PlaygroundPage";
import { WorkspaceProvider } from "./src/contexts/WorkspaceProvider";
import { ErrorBoundary } from "./src/components/ui/ErrorBoundary/ErrorBoundary";
import ErrorMonitor from "./src/lib/ErrorMonitor";
import DocumentUploader from "./src/components/chat/DocumentUploader";

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
        <div className="relative w-16 h-16 bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
          <div className="w-12 h-12 bg-slate-950 rounded-lg"></div>
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

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
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

  const defaultUser = {
    id: authUser?.id || "user-123",
    username: authUser?.name || authUser?.email || "User",
  };

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginScreen />
          </PublicRoute>
        }
      />

      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterScreen />
          </PublicRoute>
        }
      />

      {/* Protected */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeContent />} />

        <Route
          path="chat"
          element={
            <ChatContainer
              token={authToken || ""}
              userInfo={defaultUser}
            />
          }
        />

        <Route path="playground" element={<PlaygroundPage />} />
        <Route path="voice-screen" element={<VoiceScreen />} />
        <Route path="image" element={<ImageGenerator />} />
        <Route path="voice" element={<VoiceTools userId={defaultUser.id} />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="document-uploader" element={<DocumentUploader />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
