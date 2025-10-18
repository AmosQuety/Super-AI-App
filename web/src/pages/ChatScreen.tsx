// src/pages/ChatScreen.tsx
import ChatContainer from "../../src/components/chat/ChatContainer";

interface ChatScreenProps {
  token: string;
  userInfo: { id: string; username: string };
}

export default function ChatScreen({ token, userInfo }: ChatScreenProps) {
  return (
    <div className="h-screen flex flex-col">
      <ChatContainer token={token} userInfo={userInfo} />
    </div>
  );
}
