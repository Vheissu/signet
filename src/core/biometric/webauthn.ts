/**
 * Biometric Authentication via WebAuthn
 *
 * Uses the Web Authentication API to enable Touch ID / Windows Hello
 * for unlocking the wallet. The flow:
 *
 * 1. ENROLLMENT: After a successful password unlock, create a WebAuthn
 *    credential. Derive an AES key from the authenticator via the
 *    WebAuthn PRF extension, encrypt the wallet password, and store
 *    only non-secret credential metadata plus the encrypted password
 *    in chrome.storage.local.
 *
 * 2. UNLOCK: Call navigator.credentials.get() which triggers the
 *    biometric prompt. On success, derive the same AES key from the
 *    authenticator again and use it to decrypt the wallet password.
 *
 * The actual private key material from WebAuthn never leaves the
 * authenticator. We use the credential as proof that the user is
 * physically present and authenticated.
 */

const CREDENTIAL_STORAGE_KEY = 'biometric_credential';
const ENCRYPTED_PW_KEY = 'biometric_encrypted_pw';
const RP_NAME = 'Signet Wallet';
const BIOMETRIC_VERSION = 2;
const PRF_SALT_LENGTH = 32;

interface StoredBiometricCredential {
  version: number;
  id: string;
  rawId: string;
  salt: string;
}

export interface BiometricSupport {
  available: boolean;
  hasPlatformAuthenticator: boolean;
  hasPrfSupport: boolean;
  reason?: 'unsupported-browser' | 'no-platform-authenticator' | 'no-prf-support';
}

interface PRFOutputs {
  enabled?: boolean;
  results?: {
    first?: BufferSource;
    second?: BufferSource;
  };
}

type ExtensionResultsWithPRF = AuthenticationExtensionsClientOutputs & {
  prf?: PRFOutputs;
};

type PublicKeyCredentialWithCapabilities = typeof PublicKeyCredential & {
  getClientCapabilities?: () => Promise<Record<string, boolean>>;
};

function isStoredBiometricCredential(value: unknown): value is StoredBiometricCredential {
  if (!value || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;
  return (
    record.version === BIOMETRIC_VERSION &&
    typeof record.id === 'string' &&
    typeof record.rawId === 'string' &&
    typeof record.salt === 'string'
  );
}

/**
 * Check if the current browser can support biometric unlock securely.
 *
 * A supported platform authenticator is not sufficient on its own: we also
 * require WebAuthn PRF support so the decrypting key does not need to be
 * stored in extension storage.
 */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  try {
    if (!window.PublicKeyCredential) {
      return {
        available: false,
        hasPlatformAuthenticator: false,
        hasPrfSupport: false,
        reason: 'unsupported-browser',
      };
    }

    const hasPlatformAuthenticator =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

    if (!hasPlatformAuthenticator) {
      return {
        available: false,
        hasPlatformAuthenticator: false,
        hasPrfSupport: false,
        reason: 'no-platform-authenticator',
      };
    }

    const getClientCapabilities =
      (PublicKeyCredential as PublicKeyCredentialWithCapabilities).getClientCapabilities;
    if (!getClientCapabilities) {
      return {
        available: false,
        hasPlatformAuthenticator: true,
        hasPrfSupport: false,
        reason: 'unsupported-browser',
      };
    }

    const capabilities = await getClientCapabilities.call(PublicKeyCredential);
    const hasPrfSupport = capabilities['extension:prf'] === true;

    if (!hasPrfSupport) {
      return {
        available: false,
        hasPlatformAuthenticator: true,
        hasPrfSupport: false,
        reason: 'no-prf-support',
      };
    }

    return {
      available: true,
      hasPlatformAuthenticator: true,
      hasPrfSupport: true,
    };
  } catch {
    return {
      available: false,
      hasPlatformAuthenticator: false,
      hasPrfSupport: false,
      reason: 'unsupported-browser',
    };
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  const support = await getBiometricSupport();
  return support.available;
}

/**
 * Check if biometric unlock is enrolled.
 */
export async function isBiometricEnrolled(): Promise<boolean> {
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage) {
      const result = await chrome.storage.local.get([CREDENTIAL_STORAGE_KEY, ENCRYPTED_PW_KEY]);
      return isStoredBiometricCredential(result[CREDENTIAL_STORAGE_KEY]) && !!result[ENCRYPTED_PW_KEY];
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

function toArrayBuffer(buffer: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) return buffer;
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength).slice().buffer;
}

/**
 * Convert ArrayBuffer to base64 string.
 */
function bufToBase64(buf: ArrayBuffer | ArrayBufferView): string {
  const bytes = new Uint8Array(toArrayBuffer(buf));
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
 * Import a PRF output as the AES key used to wrap the wallet password.
 */
async function importBiometricKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    prfOutput as unknown as BufferSource,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt the password with the authenticator-derived key.
 */
async function encryptForBiometric(password: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encode(password) as unknown as BufferSource
  );
  return bufToBase64(iv) + ':' + bufToBase64(encrypted);
}

/**
 * Decrypt the password stored for biometric unlock.
 */
async function decryptForBiometric(encryptedStr: string, key: CryptoKey): Promise<string> {
  const [ivB64, ctB64] = encryptedStr.split(':');
  if (!ivB64 || !ctB64) {
    throw new Error('Invalid biometric payload');
  }

  const iv = base64ToBuf(ivB64);
  const ct = base64ToBuf(ctB64);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ct as unknown as BufferSource
  );
  return new TextDecoder().decode(decrypted);
}

function getPRFFirstResult(credential: PublicKeyCredential): Uint8Array | null {
  const extResults = credential.getClientExtensionResults() as ExtensionResultsWithPRF;
  const first = extResults.prf?.results?.first;

  if (!first) return null;
  return new Uint8Array(toArrayBuffer(first));
}

async function deriveBiometricKeyFromCredential(
  rawId: string,
  salt: Uint8Array
): Promise<CryptoKey | null> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: challenge as unknown as BufferSource,
      allowCredentials: [
        {
          id: base64ToBuf(rawId) as unknown as BufferSource,
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
      extensions: {
        prf: {
          eval: { first: salt },
        },
      } as AuthenticationExtensionsClientInputs,
    },
  }) as PublicKeyCredential | null;

  if (!assertion) return null;

  const prfOutput = getPRFFirstResult(assertion);
  if (!prfOutput) return null;

  return importBiometricKey(prfOutput);
}

/**
 * Derive a wrapping key for the newly-created credential.
 *
 * Some authenticators do not expose PRF output during `create()`, so we
 * immediately perform a `get()` with the fresh credential as a fallback.
 */
async function deriveEnrollmentKey(
  credential: PublicKeyCredential,
  salt: Uint8Array
): Promise<CryptoKey | null> {
  const createOutput = getPRFFirstResult(credential);
  if (createOutput) {
    return importBiometricKey(createOutput);
  }

  return deriveBiometricKeyFromCredential(bufToBase64(credential.rawId), salt);
}

/**
 * Build the metadata persisted for biometric unlock.
 */
function buildStoredCredential(credential: PublicKeyCredential, salt: Uint8Array): StoredBiometricCredential {
  return {
    version: BIOMETRIC_VERSION,
    id: credential.id,
    rawId: bufToBase64(credential.rawId),
    salt: bufToBase64(salt),
  };
}

/**
 * Enroll biometric authentication.
 * Call this after a successful password unlock.
 */
export async function enrollBiometric(password: string): Promise<boolean> {
  try {
    const salt = crypto.getRandomValues(new Uint8Array(PRF_SALT_LENGTH));

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
        extensions: {
          prf: {
            eval: { first: salt },
          },
        } as AuthenticationExtensionsClientInputs,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    const key = await deriveEnrollmentKey(credential, salt);
    if (!key) return false;

    const encryptedPassword = await encryptForBiometric(password, key);
    const credentialData = buildStoredCredential(credential, salt);

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
    const result = await chrome.storage.local.get([CREDENTIAL_STORAGE_KEY, ENCRYPTED_PW_KEY]);
    const credData = result[CREDENTIAL_STORAGE_KEY];
    const encryptedPw = result[ENCRYPTED_PW_KEY];

    if (!isStoredBiometricCredential(credData) || !encryptedPw) return null;

    const key = await deriveBiometricKeyFromCredential(credData.rawId, base64ToBuf(credData.salt));
    if (!key) return null;

    return decryptForBiometric(encryptedPw, key);
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
