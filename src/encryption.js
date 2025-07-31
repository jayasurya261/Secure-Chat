// encryption.js
class CryptoManager {
  constructor() {
    this.keyPair = null;
    this.sharedKey = null;
    this.algorithm = {
      name: 'ECDH',
      namedCurve: 'P-384'
    };
    this.aesAlgorithm = {
      name: 'AES-GCM',
      length: 256
    };
  }

  async generateKeyPair() {
    try {
      this.keyPair = await window.crypto.subtle.generateKey(
        this.algorithm,
        false, // not extractable for security
        ['deriveKey']
      );
      return this.keyPair;
    } catch (error) {
      console.error('Failed to generate key pair:', error);
      throw error;
    }
  }

  async exportPublicKey() {
    if (!this.keyPair) {
      throw new Error('Key pair not generated');
    }
    const exported = await window.crypto.subtle.exportKey(
      'raw',
      this.keyPair.publicKey
    );
    return Array.from(new Uint8Array(exported));
  }

  async deriveSharedKey(peerPublicKeyArray) {
    if (!this.keyPair) {
      throw new Error('Key pair not generated');
    }
    try {
      const peerPublicKey = await window.crypto.subtle.importKey(
        'raw',
        new Uint8Array(peerPublicKeyArray),
        this.algorithm,
        false,
        []
      );
      this.sharedKey = await window.crypto.subtle.deriveKey(
        {
          name: 'ECDH',
          public: peerPublicKey
        },
        this.keyPair.privateKey,
        this.aesAlgorithm,
        false, // not extractable
        ['encrypt', 'decrypt']
      );
      return true;
    } catch (error) {
      console.error('Failed to derive shared key:', error);
      throw error;
    }
  }

  async encrypt(message) {
    if (!this.sharedKey) {
      throw new Error('Shared key not established');
    }
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.sharedKey,
        data
      );
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      return Array.from(combined);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  async decrypt(encryptedArray) {
    if (!this.sharedKey) {
      throw new Error('Shared key not established');
    }
    try {
      const combined = new Uint8Array(encryptedArray);
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.sharedKey,
        encrypted
      );
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  async getKeyFingerprint() {
    if (!this.keyPair) {
      throw new Error('Key pair not generated');
    }
    const publicKeyRaw = await window.crypto.subtle.exportKey(
      'raw',
      this.keyPair.publicKey
    );
    const hash = await window.crypto.subtle.digest(
      'SHA-256',
      publicKeyRaw
    );
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export default CryptoManager;
