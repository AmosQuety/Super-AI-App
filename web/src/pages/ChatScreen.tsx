// src/pages/ChatScreen.tsx
import { Navigate } from "react-router-dom";
import ChatContainer from "../components/chat/ChatContainer";
import { useAuth } from "../hooks/useAuth";

interface ChatScreenProps {
  token?: string;
  userInfo?: { id: string; username: string };
}

const LoadingState = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
    <div className="flex flex-col items-center gap-4">
      <div className="h-12 w-12 rounded-2xl border-2 border-white/20 border-t-white animate-spin" />
      <p className="text-sm text-white/70">Synchronizing chat access...</p>
    </div>
  </div>
);

export default function ChatScreen({ token, userInfo }: ChatScreenProps) {
  const { user, token: authToken, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login?returnTo=%2Fchat" replace />;
  }

  const resolvedToken = token || authToken || "";
  const resolvedUserInfo =
    userInfo ||
    (user
      ? {
          id: user.id,
          username: user.name || user.email || "User",
        }
      : null);

  if (!resolvedUserInfo) {
    return <Navigate to="/login?returnTo=%2Fchat" replace />;
  }

  return (
    <div className="h-screen flex flex-col">
      <ChatContainer token={resolvedToken} userInfo={resolvedUserInfo} />
    </div>
  );
}
