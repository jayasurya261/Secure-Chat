import React from 'react';

const ChatBubble = ({ message }) => {
  return (
    <div className="w-fit max-w-xs px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-md text-white animate-fadeIn">
      {message}
    </div>
  );
};

export default ChatBubble;
