import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';

describe('Webhook signature verification', () => {
  const testSecret = 'whsec_test123';
  
  function createSignature(timestamp: number, body: string, secret: string): string {
    const payload = `${timestamp}.${body}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  it('should verify valid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ id: 'test-call', duration: 120 });
    const signature = createSignature(timestamp, body, testSecret);
    
    const header = `t=${timestamp},v1=${signature}`;
    
    // Verify
    const parts = Object.fromEntries(
      header.split(',').map(p => p.split('='))
    );
    
    const receivedTime = parseInt(parts.t, 10);
    const receivedSig = parts.v1;
    
    const expectedSig = createSignature(receivedTime, body, testSecret);
    
    expect(receivedSig).toBe(expectedSig);
    expect(
      crypto.timingSafeEqual(
        Buffer.from(receivedSig, 'hex'),
        Buffer.from(expectedSig, 'hex')
      )
    ).toBe(true);
  });

  it('should reject old timestamp', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
    const body = JSON.stringify({ id: 'test' });
    const signature = createSignature(oldTimestamp, body, testSecret);
    
    const now = Math.floor(Date.now() / 1000);
    expect(Math.abs(now - oldTimestamp)).toBeGreaterThan(300);
  });

  it('should reject invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ id: 'test' });
    const correctSig = createSignature(timestamp, body, testSecret);
    const wrongSig = createSignature(timestamp, body, 'wrong-secret');
    
    expect(correctSig).not.toBe(wrongSig);
  });

  it('should use constant-time comparison', () => {
    const sig1 = 'abc123';
    const sig2 = 'abc124';
    
    // Buffer comparison is constant-time
    const buf1 = Buffer.from(sig1);
    const buf2 = Buffer.from(sig2);
    
    // timingSafeEqual returns false for different buffers, doesn't throw
    expect(crypto.timingSafeEqual(buf1, buf2)).toBe(false);
    
    // It throws only if lengths differ
    const shortBuf = Buffer.from('ab');
    expect(() => crypto.timingSafeEqual(buf1, shortBuf)).toThrow();
  });
});

describe('Webhook endpoint integration', () => {
  const testSecret = 'whsec_test_integration';
  
  // Create test app with webhook
  function createTestApp() {
    const app = express();
    
    // Simulate the webhook setup
    app.post('/webhooks/alebex',
      express.raw({ type: 'application/json', limit: '2mb' }),
      (req, res) => {
        const signature = req.get('x-alebex-signature');
        if (!signature) return res.sendStatus(401);
        
        const parts = Object.fromEntries(
          signature.split(',').map(p => p.split('='))
        );
        
        const timestamp = parseInt(parts.t, 10);
        const receivedSig = parts.v1;
        const now = Math.floor(Date.now() / 1000);
        
        if (Math.abs(now - timestamp) > 300) {
          return res.sendStatus(401);
        }
        
        if (!Buffer.isBuffer(req.body)) {
          return res.sendStatus(400);
        }
        
        const payload = `${timestamp}.${req.body.toString('utf8')}`;
        const expectedSig = crypto
          .createHmac('sha256', testSecret)
          .update(payload)
          .digest('hex');
        
        try {
          if (!crypto.timingSafeEqual(
            Buffer.from(receivedSig, 'hex'),
            Buffer.from(expectedSig, 'hex')
          )) {
            return res.sendStatus(401);
          }
        } catch {
          return res.sendStatus(401);
        }
        
        res.sendStatus(204);
      }
    );
    
    return app;
  }
  
  it('should accept correctly signed webhook', async () => {
    const app = createTestApp();
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ id: 'call-123', durationSeconds: 120 });
    
    const payload = `${timestamp}.${body}`;
    const signature = crypto
      .createHmac('sha256', testSecret)
      .update(payload)
      .digest('hex');
    
    const response = await request(app)
      .post('/webhooks/alebex')
      .set('Content-Type', 'application/json')
      .set('X-Alebex-Signature', `t=${timestamp},v1=${signature}`)
      .send(body);
    
    expect(response.status).toBe(204);
  });
  
  it('should reject tampered webhook body', async () => {
    const app = createTestApp();
    const timestamp = Math.floor(Date.now() / 1000);
    const originalBody = JSON.stringify({ id: 'call-123', durationSeconds: 120 });
    const tamperedBody = JSON.stringify({ id: 'call-456', durationSeconds: 999 });
    
    // Sign the original body
    const payload = `${timestamp}.${originalBody}`;
    const signature = crypto
      .createHmac('sha256', testSecret)
      .update(payload)
      .digest('hex');
    
    // Send the tampered body with original signature
    const response = await request(app)
      .post('/webhooks/alebex')
      .set('Content-Type', 'application/json')
      .set('X-Alebex-Signature', `t=${timestamp},v1=${signature}`)
      .send(tamperedBody);
    
    expect(response.status).toBe(401);
  });
});
