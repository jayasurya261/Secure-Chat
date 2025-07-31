import React, { useEffect, useRef, useState, useCallback } from "react";
import Peer from "peerjs";
import MessageInput from "./MessageInput";
import ChatWindow from "./ChatWindow";
import CryptoManager from "../../../encryption"; // Import the new module

const ChatApp = () => {
  const [chatLog, setChatLog] = useState([]);
  const [peerId, setPeerId] = useState("");
  const [remoteId, setRemoteId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [peerReady, setPeerReady] = useState(false);
  const [isEncrypted, setIsEncrypted] = useState(false); // New: Encryption status
  const [keyExchangeStatus, setKeyExchangeStatus] = useState(""); // New: Key exchange status
  const [fingerprint, setFingerprint] = useState(""); // New: Key fingerprint

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const cryptoManager = useRef(new CryptoManager()); // New: Crypto instance
  const peerIdRef = useRef(peerId); // New: Ref to track latest peerId without dep loop

  // Update peerIdRef whenever peerId changes
  useEffect(() => {
    peerIdRef.current = peerId;
  }, [peerId]);

  // Initialize encryption keys
  useEffect(() => {
    const initCrypto = async () => {
      try {
        await cryptoManager.current.generateKeyPair();
        const fp = await cryptoManager.current.getKeyFingerprint();
        setFingerprint(fp.substring(0, 16) + '...'); // Display partial for brevity
      } catch (error) {
        console.error("Failed to initialize encryption:", error);
        setConnectionError("Failed to initialize encryption");
      }
    };
    initCrypto();
  }, []);

  // Handle key exchange
  const handleKeyExchange = useCallback(async (conn, isInitiator = false) => {
    try {
      setKeyExchangeStatus("Exchanging keys...");
      const publicKey = await cryptoManager.current.exportPublicKey();

      if (isInitiator) {
        conn.send({ type: 'key_exchange', publicKey });
      }

      const handleData = async (data) => {
        if (data.type === 'key_exchange' && data.publicKey) {
          try {
            await cryptoManager.current.deriveSharedKey(data.publicKey);
            setIsEncrypted(true);
            setKeyExchangeStatus("Encryption established ✅");

            if (!isInitiator) {
              conn.send({ type: 'key_exchange', publicKey });
            }
            conn.send({ type: 'key_exchange_complete' });

            setChatLog((prev) => [
              ...prev,
              { from: "system", text: "🔒 Encryption enabled", timestamp: new Date().toLocaleTimeString() },
            ]);
          } catch (error) {
            setConnectionError("Key exchange failed");
          }
        } else if (data.type === 'key_exchange_complete') {
          setKeyExchangeStatus("Encryption established ✅");
        }
      };

      conn.on('data', handleData);
      setTimeout(() => conn.removeListener('data', handleData), 10000); // Cleanup
    } catch (error) {
      setKeyExchangeStatus("Key exchange failed ❌");
    }
  }, []);

  // Clear error message
  useEffect(() => {
    if (connectionError) {
      errorTimeoutRef.current = setTimeout(() => setConnectionError(""), 5000);
    }
    return () => clearTimeout(errorTimeoutRef.current);
  }, [connectionError]);

  // Unified connection handler (now depends on [] to be stable, uses peerIdRef)
  const setupConnectionListeners = useCallback((conn) => {
    if (conn._listenersSetup) return;
    conn._listenersSetup = true;
    if (connRef.current && connRef.current !== conn) connRef.current.close();
    connRef.current = conn;

    conn.removeAllListeners("data");
    conn.removeAllListeners("close");
    conn.removeAllListeners("error");

    conn.on("data", async (data) => {
      if (data.type === 'key_exchange' || data.type === 'key_exchange_complete') return; // Handled separately

      if (data.type === 'encrypted_message') {
        try {
          const decrypted = await cryptoManager.current.decrypt(data.encryptedData);
          setChatLog((prev) => [...prev, { from: "remote", text: decrypted, timestamp: new Date().toLocaleTimeString(), encrypted: true }]);
        } catch (error) {
          setChatLog((prev) => [...prev, { from: "system", text: "⚠️ Decryption failed", timestamp: new Date().toLocaleTimeString() }]);
        }
        return;
      }

      // Fallback for plaintext (use peerIdRef.current for latest value)
      let msgObj = typeof data === 'string' ? (JSON.parse(data) || { text: data }) : data;
      if (msgObj.from === peerIdRef.current) return;
      setChatLog((prev) => [...prev, { from: "remote", text: msgObj.text || data, timestamp: new Date().toLocaleTimeString(), encrypted: false }]);
    });

    conn.on("close", () => {
      clearTimeout(connectionTimeoutRef.current);
      setIsConnected(false);
      setIsConnecting(false);
      setIsEncrypted(false);
      setKeyExchangeStatus("");
      setChatLog((prev) => [...prev, { from: "system", text: "Connection closed", timestamp: new Date().toLocaleTimeString() }]);
      connRef.current = null;
    });

    conn.on("error", (err) => {
      clearTimeout(connectionTimeoutRef.current);
      setConnectionError(`Connection error: ${err.message || err.type}`);
      setIsConnected(false);
      setIsConnecting(false);
      setIsEncrypted(false);
      setKeyExchangeStatus("");
      connRef.current = null;
    });
  }, []); // Empty deps: Stable, no loop

  // Initialize peer (now runs only once on mount)
  useEffect(() => {
    const initializePeer = () => {
      try {
        const peer = new Peer({
          config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] },
          debug: 2
        });

        peer.on("open", (id) => {
          setPeerId(id);
          setPeerReady(true);
        });

        peer.on("connection", (conn) => {
          setRemoteId(conn.peer);
          setupConnectionListeners(conn);
          conn.on("open", () => {
            setIsConnected(true);
            setIsConnecting(false);
            setChatLog((prev) => [...prev, { from: "system", text: `Accepted connection from ${conn.peer}`, timestamp: new Date().toLocaleTimeString() }]);
            handleKeyExchange(conn, false); // Responder
          });
        });

        peer.on("error", (err) => {
          setPeerReady(false);
          setConnectionError(`Peer error: ${err.message || err.type}`);
          setTimeout(() => {
            peerRef.current?.destroy();
            initializePeer();
          }, 3000);
        });

        peer.on("disconnected", () => {
          setPeerReady(false);
          peer.reconnect();
        });

        peerRef.current = peer;
      } catch (error) {
        setConnectionError("Failed to initialize peer");
      }
    };
    initializePeer();

    return () => {
      clearTimeout(connectionTimeoutRef.current);
      clearTimeout(errorTimeoutRef.current);
      peerRef.current?.destroy();
    };
  }, []); // Empty deps: Runs only once

  // Send message with encryption
  const handleSend = useCallback(async (msg) => {
    if (!msg.trim()) return;
    setChatLog((prev) => [...prev, { from: "me", text: msg, timestamp: new Date().toLocaleTimeString(), encrypted: isEncrypted }]);

    if (connRef.current?.open) {
      try {
        if (isEncrypted) {
          const encryptedData = await cryptoManager.current.encrypt(msg);
          connRef.current.send({ type: 'encrypted_message', encryptedData });
        } else {
          connRef.current.send(JSON.stringify({ text: msg, from: peerId }));
        }
      } catch (error) {
        setConnectionError("Failed to send message");
      }
    } else {
      setConnectionError("No active connection");
    }
  }, [isEncrypted, peerId]);

  // Connect function
  const connect = useCallback(() => {
    if (!peerRef.current || !peerReady || !remoteId.trim() || remoteId === peerId) {
      setConnectionError(!remoteId.trim() ? "Enter valid peer ID" : remoteId === peerId ? "Cannot connect to self" : "Peer not ready");
      return;
    }
    setIsConnecting(true);
    setConnectionError("");

    try {
      const conn = peerRef.current.connect(remoteId, { reliable: true });
      if (!conn) throw new Error("Failed to create connection");

      connectionTimeoutRef.current = setTimeout(() => {
        if (!isConnected && isConnecting) {
          setIsConnecting(false);
          setConnectionError("Connection timeout");
          conn.close();
        }
      }, 15000);

      conn.on("open", () => {
        clearTimeout(connectionTimeoutRef.current);
        setIsConnected(true);
        setIsConnecting(false);
        setChatLog((prev) => [...prev, { from: "system", text: `Connected to ${remoteId}!`, timestamp: new Date().toLocaleTimeString() }]);
        handleKeyExchange(conn, true); // Initiator
      });

      setupConnectionListeners(conn);
    } catch (error) {
      setConnectionError(`Connection failed: ${error.message}`);
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [remoteId, peerId, peerReady, isConnected, isConnecting, handleKeyExchange]);

  // Disconnect function
  const disconnect = useCallback(() => {
    clearTimeout(connectionTimeoutRef.current);
    connRef.current?.close();
    connRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setIsEncrypted(false);
    setKeyExchangeStatus("");
    setChatLog((prev) => [...prev, { from: "system", text: "Disconnected", timestamp: new Date().toLocaleTimeString() }]);
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!isConnected && !isConnecting) connect();
  };

  return (
    <div className="p-4 max-w-lg mx-auto text-white">
      <h2 className="text-xl mb-2">
        Your ID: {peerId || "Generating..."}
        {!peerReady && <span className="text-yellow-400 text-sm ml-2">(Not ready)</span>}
      </h2>
      {fingerprint && <div className="mb-2 text-sm text-gray-300">Key Fingerprint: {fingerprint}</div>}
      
      <div className="mb-4 space-y-2">
        {isConnected && (
          <div className="flex items-center gap-2 p-3 bg-green-600 bg-opacity-20 border border-green-500 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm">Connected to {remoteId}{isEncrypted ? ' 🔒' : ''}</span>
          </div>
        )}
        {keyExchangeStatus && (
          <div className="p-3 bg-blue-600 bg-opacity-20 border border-blue-500 rounded-lg text-blue-400 text-sm">
            {keyExchangeStatus}
          </div>
        )}
        {isConnecting && (
          <div className="flex items-center gap-2 p-3 bg-yellow-600 bg-opacity-20 border border-yellow-500 rounded-lg">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
            <span className="text-yellow-400 text-sm">Connecting to {remoteId}...</span>
          </div>
        )}
        {connectionError && (
          <div className="p-3 bg-red-600 bg-opacity-20 border border-red-500 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-red-400 text-sm">{connectionError}</span>
              <button onClick={() => setConnectionError("")} className="text-red-400 hover:text-red-300 ml-2">✕</button>
            </div>
          </div>
        )}
        {!peerReady && (
          <div className="flex items-center gap-2 p-3 bg-blue-600 bg-opacity-20 border border-blue-500 rounded-lg">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-blue-400 text-sm">Initializing peer...</span>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <div className="flex flex-col justify-center items-center px-4">
          <div className="relative w-60 group">
            <span className="absolute -left-0.5 top-2 bottom-2 w-1.5 rounded bg-gradient-to-b from-indigo-500 to-purple-500 opacity-70 transition-all duration-300 group-focus-within:opacity-100"></span>
            <input
              type="text"
              id="input"
              placeholder=""
              className="peer w-full pl-6 pr-4 pt-6 pb-2 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg shadow-md focus:border-transparent focus:ring-2 focus:ring-indigo-300 focus:outline-none transition-all duration-300 delay-200 placeholder-transparent"
              value={remoteId}
              onChange={(e) => setRemoteId(e.target.value)}
              disabled={isConnected || isConnecting || !peerReady}
            />
            <label
              htmlFor="input"
              className="absolute left-6 top-1 text-sm text-gray-500 transition-all duration-200 ease-in-out peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-focus:top-1 peer-focus:text-sm peer-focus:text-indigo-500 peer-focus:font-semibold cursor-text"
            >
              Enter Peer ID
            </label>
          </div>
        </div>

        {!isConnected ? (
          <button
            type="submit"
            className={`relative group border-none bg-transparent p-0 outline-none cursor-pointer font-mono font-light uppercase text-base ${
              (isConnecting || !peerReady || !remoteId.trim()) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={isConnecting || !peerReady || !remoteId.trim()}
          >
            <span className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-25 rounded-lg transform translate-y-0.5 transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:translate-y-1 group-hover:duration-[250ms] group-active:translate-y-px"></span>

            <span className="absolute top-0 left-0 w-full h-full rounded-lg bg-gradient-to-l from-[hsl(217,33%,16%)] via-[hsl(217,33%,32%)] to-[hsl(217,33%,16%)]"></span>

            <div className="relative flex items-center justify-between py-3 px-3 text-lg text-white rounded-lg transform -translate-y-1 bg-gradient-to-r from-[#f27121] via-[#e94057] to-[#8a2387] gap-3 transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:-translate-y-1.5 group-hover:duration-[250ms] group-active:-translate-y-0.5 brightness-100 group-hover:brightness-110">
              <span className="select-none">
                {isConnecting ? 'Connecting...' : 'Start session'}
              </span>

              {isConnecting ? (
                <div className="w-5 h-5 ml-2 -mr-1">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5 ml-2 -mr-1 transition duration-250 group-hover:translate-x-1"
                >
                  <path
                    clipRule="evenodd"
                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                    fillRule="evenodd"
                  ></path>
                </svg>
              )}
            </div>
          </button>
        ) : (
          <button
            type="button"
            className="relative group border-none bg-transparent p-0 outline-none cursor-pointer font-mono font-light uppercase text-base"
            onClick={disconnect}
          >
            <span className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-25 rounded-lg transform translate-y-0.5 transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:translate-y-1 group-hover:duration-[250ms] group-active:translate-y-px"></span>

            <span className="absolute top-0 left-0 w-full h-full rounded-lg bg-gradient-to-l from-[hsl(217,33%,16%)] via-[hsl(217,33%,32%)] to-[hsl(217,33%,16%)]"></span>

            <div className="relative flex items-center justify-between py-3 px-3 text-lg text-white rounded-lg transform -translate-y-1 bg-gradient-to-r from-red-500 via-red-600 to-red-700 gap-3 transition duration-[600ms] ease-[cubic-bezier(0.3,0.7,0.4,1)] group-hover:-translate-y-1.5 group-hover:duration-[250ms] group-active:-translate-y-0.5 brightness-100 group-hover:brightness-110">
              <span className="select-none">Disconnect</span>

              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5 ml-2 -mr-1"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </button>
        )}
      </form>

      <ChatWindow
        messages={chatLog.map((msg) => {
          const timeStr = msg.timestamp ? ` (${msg.timestamp})` : '';
          const encIndicator = msg.encrypted ? ' ' : '';
          if (msg.from === "me") return `🟢 You: ${encIndicator}${msg.text}${timeStr}`;
          if (msg.from === "remote") return `🔵 Peer: ${encIndicator}${msg.text}${timeStr}`;
          if (msg.from === "system") return `ℹ️ ${msg.text}${timeStr}`;
          return msg.text;
        })}
      />

      <MessageInput 
        onSend={handleSend} 
        peerConnection={connRef.current} 
        disabled={!isConnected}
      />
    </div>
  );
};

export default ChatApp;
