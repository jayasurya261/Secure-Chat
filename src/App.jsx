import React, { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import FileUploader from './components/FileUploader';
import InviteLinkGenerator from './components/InviteLinkGenerator';
import ChatApp from './components/ChatApp';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { FeaturesSectionDemo } from './ui/FeatureDection';
import { WobbleCardDemo } from './ui/wobble-card-demo';


const App = () => {
  const [messages, setMessages] = useState([
    "Welcome to SecureChat! 🔐"
  ]);

  const handleSend = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleFileSend = (file) => {
    setMessages((prev) => [
      ...prev,
      `📎 Sent file: ${file.name}`
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
          🛡️ SecureChat
        </h1>

        <div>
          <SignedOut>
            <SignInButton >
             
<button
  class="group/button relative inline-flex items-center justify-center overflow-hidden rounded-md bg-blue-500/30 backdrop-blur-lg px-6 py-2 text-base font-semibold text-white transition-all duration-300 ease-in-out hover:scale-110 hover:shadow-xl hover:shadow-blue-600/50 border border-white/20"
>
  <span class="text-lg">Sign In</span>
  <div
    class="absolute inset-0 flex h-full w-full justify-center [transform:skew(-13deg)_translateX(-100%)] group-hover/button:duration-1000 group-hover/button:[transform:skew(-13deg)_translateX(100%)]"
  >
    <div class="relative h-full w-10 bg-white/30"></div>
  </div>
</button>

              </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      <SignedIn>
        <div className="max-w-2xl mx-auto bg-black/40 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-white/10 flex flex-col gap-6">
          <ChatApp />
        </div>
      </SignedIn>

      <SignedOut><div>

      </div>
       <WobbleCardDemo/>
      </SignedOut>
    </div>
  );
};

export default App;
