// App.tsx
import React from "react";
import ChatScreen from "./src/pages/ChatScreen";
import VoiceScreen from "./src/pages/VoiceScreen";
import ImageGenerator from "./src/components/ImageGenerator";
import VoiceTools from "./src/components/VoiceTools";
import ChatContainer from "./src/components/chat/ChatContainer";
import Layout from "./src/components/Layout";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./index.css";

export default function App() {
  const currentUserId = "user-123";

  return (
    <Router>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <ChatContainer
                token="your_token_here"
                userInfo={{ id: currentUserId, username: "User Name" }}
              />
            }
          />
          <Route path="voice-screen" element={<VoiceScreen />} />
          <Route
            path="chat"
            element={
              <ChatScreen
                token="your_token_here"
                userInfo={{ id: currentUserId, username: "User Name" }}
              />
            }
          />
          <Route path="/image" element={<ImageGenerator />} />
          <Route
            path="/voice"
            element={<VoiceTools userId={currentUserId} />}
          />
        </Routes>
      </Layout>
    </Router>
  );
}
