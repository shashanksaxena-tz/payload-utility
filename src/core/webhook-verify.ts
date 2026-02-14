/**
 * Webhook Signature Verification
 *
 * Provides HMAC-SHA256 signature verification for incoming webhook payloads
 * using a Stripe-like signature header format: t=<timestamp>,v1=<hmac>
 *
 * Usage:
 *   import { WebhookVerifier } from 'payload-utility';
 *   const verifier = new WebhookVerifier('whsec_your_signing_secret');
 *   const event = verifier.constructEvent(req.body, req.headers['x-payload-signature']);
 */

import { createHmac, timingSafeEqual } from 'crypto';

export interface WebhookEvent {
  id: string;
  type: string;
  created_at: string;
  data: Record<string, unknown>;
  livemode: boolean;
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

export interface ParsedSignatureHeader {
  timestamp: number;
  signatures: string[];
}

/**
 * Parse a webhook signature header into its timestamp and signature components.
 *
 * Header format: t=<unix_timestamp>,v1=<hex_hmac>[,v1=<hex_hmac>...]
 */
export function parseSignatureHeader(header: string): ParsedSignatureHeader {
  if (!header || typeof header !== 'string') {
    throw new WebhookVerificationError('Missing or invalid signature header');
  }

  const parts = header.split(',');
  let timestamp = -1;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (!key || !value) {
      continue;
    }
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();

    if (trimmedKey === 't') {
      const parsed = Number(trimmedValue);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new WebhookVerificationError('Invalid timestamp in signature header');
      }
      timestamp = parsed;
    } else if (trimmedKey === 'v1') {
      signatures.push(trimmedValue);
    }
  }

  if (timestamp < 0) {
    throw new WebhookVerificationError('Missing timestamp in signature header');
  }

  if (signatures.length === 0) {
    throw new WebhookVerificationError('Missing v1 signature in signature header');
  }

  return { timestamp, signatures };
}

export class WebhookVerifier {
  private readonly secret: string;

  constructor(secret: string) {
    if (!secret || typeof secret !== 'string') {
      throw new WebhookVerificationError('Webhook signing secret is required');
    }
    this.secret = secret;
  }

  /**
   * Generate an HMAC-SHA256 signature header for a payload.
   *
   * The signed content is `<timestamp>.<payload>` to bind the signature
   * to a specific point in time, preventing replay attacks.
   *
   * Returns a header string in the format: t=<timestamp>,v1=<hex_hmac>
   */
  sign(payload: string | Buffer, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const payloadStr = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    const signedContent = `${ts}.${payloadStr}`;
    const hmac = createHmac('sha256', this.secret)
      .update(signedContent, 'utf8')
      .digest('hex');
    return `t=${ts},v1=${hmac}`;
  }

  /**
   * Verify a webhook signature against a payload.
   *
   * @param payload - The raw request body (string or Buffer)
   * @param signature - The signature header value (t=...,v1=...)
   * @param tolerance - Maximum allowed age in seconds (default: 300 = 5 minutes)
   * @returns true if the signature is valid, false otherwise
   */
  verify(payload: string | Buffer, signature: string, tolerance: number = 300): boolean {
    try {
      const { timestamp, signatures } = parseSignatureHeader(signature);

      // Check timestamp tolerance
      const now = Math.floor(Date.now() / 1000);
      if (tolerance > 0 && Math.abs(now - timestamp) > tolerance) {
        return false;
      }

      // Compute expected signature
      const payloadStr = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
      const signedContent = `${timestamp}.${payloadStr}`;
      const expectedHmac = createHmac('sha256', this.secret)
        .update(signedContent, 'utf8')
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedHmac, 'utf8');

      // Check if any provided v1 signature matches using timing-safe comparison
      for (const sig of signatures) {
        const sigBuffer = Buffer.from(sig, 'utf8');
        if (sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer)) {
          return true;
        }
      }

      return false;
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return false;
      }
      return false;
    }
  }

  /**
   * Parse and verify a webhook payload in one step.
   *
   * @param payload - The raw request body as a string
   * @param signature - The signature header value (t=...,v1=...)
   * @param tolerance - Maximum allowed age in seconds (default: 300 = 5 minutes)
   * @returns The parsed WebhookEvent
   * @throws WebhookVerificationError if verification fails or payload is invalid
   */
  constructEvent(payload: string, signature: string, tolerance: number = 300): WebhookEvent {
    const { timestamp, signatures } = parseSignatureHeader(signature);

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (tolerance > 0 && Math.abs(now - timestamp) > tolerance) {
      throw new WebhookVerificationError(
        `Webhook timestamp too old. Event timestamp: ${timestamp}, current time: ${now}, tolerance: ${tolerance}s`
      );
    }

    // Compute expected signature
    const signedContent = `${timestamp}.${payload}`;
    const expectedHmac = createHmac('sha256', this.secret)
      .update(signedContent, 'utf8')
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedHmac, 'utf8');
    let verified = false;

    for (const sig of signatures) {
      const sigBuffer = Buffer.from(sig, 'utf8');
      if (sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer)) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      throw new WebhookVerificationError('Webhook signature verification failed');
    }

    // Parse the payload into a WebhookEvent
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      throw new WebhookVerificationError('Invalid JSON in webhook payload');
    }

    const event: WebhookEvent = {
      id: (parsed.id as string) || '',
      type: (parsed.type as string) || '',
      created_at: (parsed.created_at as string) || '',
      data: (parsed.data as Record<string, unknown>) || {},
      livemode: Boolean(parsed.livemode),
    };

    return event;
  }
}
