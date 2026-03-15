/**
 * QR Code generation and scanning for Hive transfers.
 *
 * Two URI formats supported:
 *   1. Signet native:  hive://transfer?to=USERNAME&amount=AMOUNT&currency=CURRENCY&memo=MEMO
 *   2. Hivesigner:     https://hivesigner.com/sign/transfer?to=USERNAME&amount=AMOUNT%20CURRENCY&memo=MEMO
 *
 * Hivesigner URLs work on mobile — scanning opens a browser where the user
 * can sign the transfer through Hivesigner's web interface. No extension needed.
 */

import QRCode from 'qrcode';

export interface HiveTransferQR {
  to: string;
  amount?: string;
  currency?: string;
  memo?: string;
}

/**
 * Build a Signet-native hive:// transfer URI.
 * Best for desktop Signet-to-Signet transfers.
 */
export function buildTransferUri(data: HiveTransferQR): string {
  const params = new URLSearchParams();
  params.set('to', data.to);
  if (data.amount) params.set('amount', data.amount);
  if (data.currency) params.set('currency', data.currency);
  if (data.memo) params.set('memo', data.memo);
  return `hive://transfer?${params.toString()}`;
}

/**
 * Build a Hivesigner URL for the transfer.
 * Works on mobile — opens in any browser, user signs via Hivesigner.
 */
export function buildHivesignerUrl(data: HiveTransferQR): string {
  const params = new URLSearchParams();
  params.set('to', data.to);
  if (data.amount && data.currency) {
    params.set('amount', `${data.amount} ${data.currency}`);
  }
  if (data.memo) params.set('memo', data.memo);
  return `https://hivesigner.com/sign/transfer?${params.toString()}`;
}

/**
 * Build a simple receive URI (just the username).
 */
export function buildReceiveUri(username: string): string {
  return `hive://transfer?to=${encodeURIComponent(username)}`;
}

/**
 * Parse a transfer URI back into structured data.
 * Supports: hive:// URIs, Hivesigner URLs, and plain usernames.
 */
export function parseTransferUri(uri: string): HiveTransferQR | null {
  try {
    // Handle Hivesigner URLs
    if (uri.includes('hivesigner.com')) {
      const url = new URL(uri);
      const params = url.searchParams;
      const to = params.get('to');
      if (!to) return null;

      // Hivesigner encodes amount as "10.000 HIVE" in a single param
      const amountRaw = params.get('amount') || '';
      const amountParts = amountRaw.trim().split(' ');

      return {
        to,
        amount: amountParts[0] || undefined,
        currency: amountParts[1] || undefined,
        memo: params.get('memo') || undefined,
      };
    }

    // Handle hive:// URIs
    const normalized = uri.replace('hive://', 'https://hive/');
    const url = new URL(normalized);
    const params = url.searchParams;

    const to = params.get('to');
    if (!to) return null;

    return {
      to,
      amount: params.get('amount') || undefined,
      currency: params.get('currency') || undefined,
      memo: params.get('memo') || undefined,
    };
  } catch {
    // Try simple username format
    const clean = uri.replace(/^@/, '').trim();
    if (clean && /^[a-z0-9.-]+$/.test(clean)) {
      return { to: clean };
    }
    return null;
  }
}

/**
 * Generate a QR code as a data URL (PNG base64).
 */
export async function generateQRDataUrl(
  data: string,
  options?: {
    width?: number;
    darkColor?: string;
    lightColor?: string;
  }
): Promise<string> {
  return QRCode.toDataURL(data, {
    width: options?.width || 200,
    margin: 2,
    color: {
      dark: options?.darkColor || '#F0ECF5',
      light: options?.lightColor || '#1A1128',
    },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Generate a QR code for receiving Hive.
 */
export async function generateReceiveQR(
  username: string,
  options?: { width?: number }
): Promise<string> {
  const uri = buildReceiveUri(username);
  return generateQRDataUrl(uri, options);
}

/**
 * Generate a QR code for a specific transfer request.
 */
export async function generateTransferQR(
  data: HiveTransferQR,
  options?: { width?: number }
): Promise<string> {
  const uri = buildTransferUri(data);
  return generateQRDataUrl(uri, options);
}

/**
 * Scan a QR code from an image file using jsQR.
 * Returns the decoded string or null.
 */
export async function scanQRFromImage(imageFile: File): Promise<string | null> {
  const jsQR = (await import('jsqr')).default;

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        resolve(code?.data || null);
      };
      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Scan a QR code from the device camera.
 * Returns a promise that resolves with the decoded string.
 * Pass an AbortSignal to cancel.
 */
export async function scanQRFromCamera(
  videoElement: HTMLVideoElement,
  signal?: AbortSignal
): Promise<string | null> {
  const jsQR = (await import('jsqr')).default;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 640, height: 480 },
    });

    videoElement.srcObject = stream;
    await videoElement.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    return new Promise((resolve) => {
      const scan = () => {
        if (signal?.aborted) {
          stream.getTracks().forEach((t) => t.stop());
          resolve(null);
          return;
        }

        if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          ctx.drawImage(videoElement, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height);

          if (code) {
            stream.getTracks().forEach((t) => t.stop());
            resolve(code.data);
            return;
          }
        }

        requestAnimationFrame(scan);
      };

      scan();
    });
  } catch {
    return null;
  }
}
