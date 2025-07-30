import React, { useState } from 'react';

const InviteLinkGenerator = () => {
  const [inviteLink, setInviteLink] = useState('');

  const generateInvite = () => {
    const hash = Math.random().toString(36).substr(2, 10);
    const newLink = `https://securechat.app/invite/${hash}`;
    setInviteLink(newLink);
  };

  return (
    <div className="mt-6 p-4 bg-black/30 backdrop-blur-sm rounded-2xl border border-white/20 flex flex-col gap-4">
      <h2 className="text-xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        🔗 Generate Invite Link
      </h2>

      <button
        onClick={generateInvite}
        className="self-center bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-6 py-2 rounded-full transition-transform transform hover:scale-105"
      >
        Create Invite
      </button>

      {inviteLink && (
        <div className="pt-2 flex flex-col items-center">
          <p className="break-all text-center bg-white/10 text-purple-200 px-4 py-2 rounded-lg font-mono select-all hover:bg-white/20 transition">
            {inviteLink}
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(inviteLink)}
            className="mt-2 text-sm text-white/70 hover:text-white transition"
          >
            Copy Link
          </button>
        </div>
      )}
    </div>
  );
};

export default InviteLinkGenerator;
