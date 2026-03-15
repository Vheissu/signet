/**
 * Biometric Authentication via WebAuthn
 *
 * Uses the Web Authentication API to enable Touch ID / Windows Hello
 * for unlocking the wallet. The flow:
 *
 * 1. ENROLLMENT: After a successful password unlock, create a WebAuthn
 *    credential. Encrypt the wallet password with a key derived from
 *    a random secret, and store the secret + encrypted password in
 *    chrome.storage.local.
 *
 * 2. UNLOCK: Call navigator.credentials.get() which triggers the
 *    biometric prompt. On success, use the stored secret to decrypt
 *    the wallet password and unlock normally.
 *
 * The actual private key material from WebAuthn never leaves the
 * authenticator. We use the credential as proof that the user is
 * physically present and authenticated.
 */

const CREDENTIAL_STORAGE_KEY = 'biometric_credential';
const ENCRYPTED_PW_KEY = 'biometric_encrypted_pw';
const RP_ID = 'signet-wallet';
const RP_NAME = 'Signet Wallet';

/**
 * Check if WebAuthn / platform authenticator is available.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Check if biometric unlock is enrolled.
 */
export async function isBiometricEnrolled(): Promise<boolean> {
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage) {
      const result = await chrome.storage.local.get([CREDENTIAL_STORAGE_KEY, ENCRYPTED_PW_KEY]);
      return !!(result[CREDENTIAL_STORAGE_KEY] && result[ENCRYPTED_PW_KEY]);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Encode a string to Uint8Array.
 */
function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert ArrayBuffer to base64 string.
 */
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array.
 */
function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encrypt the password with a random key for biometric storage.
 */
async function encryptForBiometric(
  password: string,
  secret: Uint8Array
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secret as unknown as BufferSource,
    'AES-GCM',
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encode(password) as unknown as BufferSource
  );
  // Store as iv:ciphertext in base64
  return bufToBase64(iv.buffer as ArrayBuffer) + ':' + bufToBase64(encrypted);
}

/**
 * Decrypt the password stored for biometric unlock.
 */
async function decryptForBiometric(
  encryptedStr: string,
  secret: Uint8Array
): Promise<string> {
  const [ivB64, ctB64] = encryptedStr.split(':');
  const iv = base64ToBuf(ivB64);
  const ct = base64ToBuf(ctB64);

  const key = await crypto.subtle.importKey(
    'raw',
    secret as unknown as BufferSource,
    'AES-GCM',
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ct as unknown as BufferSource
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Enroll biometric authentication.
 * Call this after a successful password unlock.
 */
export async function enrollBiometric(password: string): Promise<boolean> {
  try {
    // Generate a random 256-bit secret for encrypting the password
    const secret = crypto.getRandomValues(new Uint8Array(32));

    // Create a WebAuthn credential (triggers Touch ID / Windows Hello)
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: RP_NAME },
        user: {
          id: userId as unknown as BufferSource,
          name: 'signet-user',
          displayName: 'Signet Wallet User',
        },
        challenge: challenge as unknown as BufferSource,
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Force Touch ID / built-in
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    }) as PublicKeyCredential;

    if (!credential) return false;

    // Encrypt the password with our secret
    const encryptedPassword = await encryptForBiometric(password, secret);

    // Store everything needed for future authentication
    const credentialData = {
      id: credential.id,
      rawId: bufToBase64(credential.rawId as ArrayBuffer),
      secret: bufToBase64(secret.buffer as ArrayBuffer),
    };

    await chrome.storage.local.set({
      [CREDENTIAL_STORAGE_KEY]: credentialData,
      [ENCRYPTED_PW_KEY]: encryptedPassword,
    });

    return true;
  } catch (err) {
    console.error('[Signet] Biometric enrollment failed:', err);
    return false;
  }
}

/**
 * Authenticate with biometrics and return the decrypted wallet password.
 */
export async function authenticateWithBiometric(): Promise<string | null> {
  try {
    // Load stored credential data
    const result = await chrome.storage.local.get([CREDENTIAL_STORAGE_KEY, ENCRYPTED_PW_KEY]);
    const credData = result[CREDENTIAL_STORAGE_KEY];
    const encryptedPw = result[ENCRYPTED_PW_KEY];

    if (!credData || !encryptedPw) return null;

    // Trigger the biometric prompt
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge as unknown as BufferSource,
        allowCredentials: [
          {
            id: base64ToBuf(credData.rawId) as unknown as BufferSource,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential;

    if (!assertion) return null;

    // Biometric succeeded — decrypt the password
    const secret = base64ToBuf(credData.secret);
    const password = await decryptForBiometric(encryptedPw, secret);

    return password;
  } catch (err) {
    console.error('[Signet] Biometric authentication failed:', err);
    return null;
  }
}

/**
 * Remove biometric enrollment.
 */
export async function removeBiometric(): Promise<void> {
  try {
    await chrome.storage.local.remove([CREDENTIAL_STORAGE_KEY, ENCRYPTED_PW_KEY]);
  } catch {
    // ignore
  }
}
