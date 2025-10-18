import React from "react";
import VoiceTools from "../components/VoiceTools";

export default function VoiceScreen() {
  // In a real app, you would get this ID from your authentication context
  const currentUserId = "user-123";

  return (
    <div className="p-6">
      {/* Pass the userId as a prop to the VoiceTools component */}
      <VoiceTools userId={currentUserId} />
    </div>
  );
}
