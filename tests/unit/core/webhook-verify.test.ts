import {
  WebhookVerifier,
  WebhookVerificationError,
  parseSignatureHeader,
} from '../../../src/core/webhook-verify';

const TEST_SECRET = 'whsec_test_secret_key_12345';

describe('parseSignatureHeader', () => {
  it('should parse a valid header with one signature', () => {
    const result = parseSignatureHeader('t=1700000000,v1=abcdef123456');
    expect(result.timestamp).toBe(1700000000);
    expect(result.signatures).toEqual(['abcdef123456']);
  });

  it('should parse a header with multiple v1 signatures', () => {
    const result = parseSignatureHeader('t=1700000000,v1=sig1,v1=sig2');
    expect(result.timestamp).toBe(1700000000);
    expect(result.signatures).toEqual(['sig1', 'sig2']);
  });

  it('should throw on missing header', () => {
    expect(() => parseSignatureHeader('')).toThrow(WebhookVerificationError);
  });

  it('should throw on invalid timestamp', () => {
    expect(() => parseSignatureHeader('t=notanumber,v1=abc')).toThrow(WebhookVerificationError);
  });

  it('should throw on missing timestamp', () => {
    expect(() => parseSignatureHeader('v1=abc')).toThrow(WebhookVerificationError);
  });

  it('should throw on missing signature', () => {
    expect(() => parseSignatureHeader('t=1700000000')).toThrow(WebhookVerificationError);
  });
});

describe('WebhookVerifier', () => {
  describe('constructor', () => {
    it('should create verifier with a valid secret', () => {
      expect(() => new WebhookVerifier(TEST_SECRET)).not.toThrow();
    });

    it('should throw when secret is empty', () => {
      expect(() => new WebhookVerifier('')).toThrow(WebhookVerificationError);
    });
  });

  describe('sign', () => {
    it('should produce a header with t= and v1= components', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const header = verifier.sign('{"test":true}', 1700000000);

      expect(header).toMatch(/^t=1700000000,v1=[0-9a-f]+$/);
    });

    it('should produce deterministic signatures for the same input', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const sig1 = verifier.sign('payload', 1000);
      const sig2 = verifier.sign('payload', 1000);
      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different payloads', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const sig1 = verifier.sign('payload_a', 1000);
      const sig2 = verifier.sign('payload_b', 1000);
      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different timestamps', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const sig1 = verifier.sign('payload', 1000);
      const sig2 = verifier.sign('payload', 2000);
      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different secrets', () => {
      const v1 = new WebhookVerifier('secret_a');
      const v2 = new WebhookVerifier('secret_b');
      const sig1 = v1.sign('payload', 1000);
      const sig2 = v2.sign('payload', 1000);
      expect(sig1).not.toBe(sig2);
    });

    it('should accept Buffer payload', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const strSig = verifier.sign('test', 1000);
      const bufSig = verifier.sign(Buffer.from('test'), 1000);
      expect(strSig).toBe(bufSig);
    });
  });

  describe('verify', () => {
    it('should verify a valid signature', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = '{"id":"evt_1","type":"payment.created"}';
      const ts = Math.floor(Date.now() / 1000);
      const header = verifier.sign(payload, ts);

      expect(verifier.verify(payload, header)).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const ts = Math.floor(Date.now() / 1000);
      const header = `t=${ts},v1=0000000000000000000000000000000000000000000000000000000000000000`;

      expect(verifier.verify('payload', header)).toBe(false);
    });

    it('should reject an expired timestamp', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = 'test';
      const oldTs = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      const header = verifier.sign(payload, oldTs);

      expect(verifier.verify(payload, header, 300)).toBe(false);
    });

    it('should accept within tolerance window', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = 'test';
      const recentTs = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      const header = verifier.sign(payload, recentTs);

      expect(verifier.verify(payload, header, 300)).toBe(true);
    });

    it('should skip tolerance check when tolerance is 0', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = 'test';
      const oldTs = 1000; // very old
      const header = verifier.sign(payload, oldTs);

      expect(verifier.verify(payload, header, 0)).toBe(true);
    });

    it('should return false for malformed header instead of throwing', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      expect(verifier.verify('payload', 'invalid-header')).toBe(false);
    });

    it('should accept Buffer payload', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = '{"test":true}';
      const ts = Math.floor(Date.now() / 1000);
      const header = verifier.sign(payload, ts);

      expect(verifier.verify(Buffer.from(payload), header)).toBe(true);
    });
  });

  describe('constructEvent', () => {
    it('should return parsed WebhookEvent for valid signature', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = JSON.stringify({
        id: 'evt_123',
        type: 'payment.created',
        created_at: '2026-01-01T00:00:00Z',
        data: { amount: 100 },
        livemode: false,
      });
      const ts = Math.floor(Date.now() / 1000);
      const header = verifier.sign(payload, ts);

      const event = verifier.constructEvent(payload, header);
      expect(event.id).toBe('evt_123');
      expect(event.type).toBe('payment.created');
      expect(event.data).toEqual({ amount: 100 });
      expect(event.livemode).toBe(false);
    });

    it('should throw for invalid signature', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const ts = Math.floor(Date.now() / 1000);
      const header = `t=${ts},v1=bad_signature`;

      expect(() => verifier.constructEvent('{}', header)).toThrow(WebhookVerificationError);
    });

    it('should throw for expired timestamp', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = '{}';
      const oldTs = Math.floor(Date.now() / 1000) - 600;
      const header = verifier.sign(payload, oldTs);

      expect(() => verifier.constructEvent(payload, header, 300))
        .toThrow(WebhookVerificationError);
    });

    it('should throw for invalid JSON payload', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = 'not valid json';
      const ts = Math.floor(Date.now() / 1000);
      const header = verifier.sign(payload, ts);

      expect(() => verifier.constructEvent(payload, header))
        .toThrow(WebhookVerificationError);
    });
  });

  describe('sign produces verifiable signatures', () => {
    it('sign output should be verifiable by verify', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = '{"action":"test","value":42}';
      const ts = Math.floor(Date.now() / 1000);
      const header = verifier.sign(payload, ts);

      expect(verifier.verify(payload, header)).toBe(true);
    });

    it('sign output should be parseable by constructEvent', () => {
      const verifier = new WebhookVerifier(TEST_SECRET);
      const payload = JSON.stringify({
        id: 'evt_456',
        type: 'customer.deleted',
        created_at: '2026-02-01',
        data: {},
        livemode: true,
      });
      const ts = Math.floor(Date.now() / 1000);
      const header = verifier.sign(payload, ts);

      const event = verifier.constructEvent(payload, header);
      expect(event.id).toBe('evt_456');
      expect(event.livemode).toBe(true);
    });
  });
});
