// App.tsx - Fixed version
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./src/contexts/AuthContext";
import { ThemeProvider } from "./src/contexts/ThemeContext"
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

// Loading Component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950">
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 relative">
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 rounded-full animate-ping opacity-75"></div>
        <div className="relative w-16 h-16 bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
          <div className="w-12 h-12 bg-slate-950 rounded-lg"></div>
        </div>
      </div>
      <div className="text-lg font-medium text-white">Loading...</div>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route Component (redirects to home if already authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

// Home Content Component
const HomeContent = () => (
  <div className="text-center py-16">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
      Welcome to Super AI Assistant
    </h2>
    <p className="text-gray-600 dark:text-gray-300">
      Select a feature from the navigation to get started
    </p>
  </div>
);

// Main App Routes Component
const AppRoutes = () => {
  const { user: authUser, token: authToken } = useAuth();
  
  // Default values for development/fallback
  const defaultUser = {
    id: authUser?.id || "user-123",
    username: authUser?.name || authUser?.email || "User"
  };

  return (
    <Routes>
      {/* Public Routes - Outside Layout */}
      <Route path="/login" element={
        <PublicRoute>
          <LoginScreen />
        </PublicRoute>
      } />
      
      <Route path="/register" element={
        <PublicRoute>
          <RegisterScreen />
        </PublicRoute>
      } />

      {/* Protected Routes - Inside Layout */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        {/* Home Route */}
        <Route index element={<HomeContent />} />

        {/* Chat Route */}
        <Route
          path="chat"
          element={
            <ChatContainer
              token={authToken || ""}
              userInfo={defaultUser}
            />
          }
        />
        
        {/* Voice Screen Route */}
        <Route 
          path="voice-screen" 
          element={<VoiceScreen />} 
        />
        
        {/* Image Generation Route */}
        <Route 
          path="image" 
          element={<ImageGenerator />} 
        />
        
        {/* Voice Tools Route */}
        <Route
          path="voice"
          element={<VoiceTools userId={defaultUser.id} />}
        />
      </Route>

      <Route
        path="/profile"
        element={<ProfilePage />}
      />

      {/* Redirect unknown routes to the main dashboard or login */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// Main App Component
export default function App() {
  return (
    <ThemeProvider>
    <ToastProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppRoutes />
          </div>
        </Router>
      </AuthProvider>
    </ToastProvider>
    </ThemeProvider>
  );
}