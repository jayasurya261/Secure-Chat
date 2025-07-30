import React, { useRef, useEffect } from 'react';
import ChatBubble from './ChatBubble';

const ChatWindow = ({ messages }) => {
  const containerRef = useRef();

  // Whenever messages change, scroll to bottom
  useEffect(() => {
    const el = containerRef.current;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-4 p-4 bg-black/30 rounded-xl h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-transparent"
    >
      {messages.map((msg, i) => (
        <ChatBubble key={i} message={msg} />
      ))}
    </div>
  );
};

export default ChatWindow;
