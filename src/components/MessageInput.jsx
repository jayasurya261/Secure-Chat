import React, { useState } from "react";
import Picker from "@emoji-mart/react";
import emojiData from "@emoji-mart/data";

const MessageInput = ({ onSend, peerConnection }) => {
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const handleSend = () => {
    if (input.trim()) {
      onSend(input); // For local display
      if (peerConnection?.open) {
        peerConnection.send(input); // Send to peer via PeerJS
      } else {
        console.warn("Peer connection not open");
      }
      setInput("");
    }
  };

  const handleEmojiSelect = (emoji) => {
    setInput((text) => text + emoji.native);
  };

  return (
    <div className="relative mt-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="text-2xl focus:outline-none"
        >
          😊
        </button>

        <input
          type="text"
          className="flex-1 px-4 py-2 rounded-full bg-white/10 text-white border border-white/20 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />

        <button
          onClick={handleSend}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-full text-white font-semibold transition-all duration-300"
        >
          Send
        </button>
      </div>

      {showPicker && (
        <div className="absolute bottom-14 left-0 z-20">
          <Picker data={emojiData} onEmojiSelect={handleEmojiSelect} />
        </div>
      )}
    </div>
  );
};

export default MessageInput;
