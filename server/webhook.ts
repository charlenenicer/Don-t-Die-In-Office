import type { Express, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.ALEBEX_WEBHOOK_SECRET || '';

interface EndOfCallReport {
  id: string;
  agentId?: string;
  callType: string;
  direction?: string;
  from?: string;
  to?: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  endedReason: string;
  transcript?: string;
  messages?: Array<{ role: string; text: string; secondsFromStart: number }>;
  events?: any[];
  toolCalls?: any[];
  recordingUrl?: string;
}

export function setupWebhook(app: Express) {
  // Store for call summaries
  const callMemories = new Map<string, string>();

  // Raw body parser for webhook signature verification
  // This MUST be registered before express.json() to preserve raw bytes
  app.post('/webhooks/alebex',
    express.raw({ type: 'application/json', limit: '2mb' }),
    (req: Request, res: Response) => {
      // Verify signature if secret is configured
      if (WEBHOOK_SECRET && !verifySignature(req)) {
        console.error('Invalid webhook signature');
        return res.sendStatus(401);
      }

      // Parse the JSON body (req.body is a Buffer from express.raw)
      let report: EndOfCallReport;
      try {
        report = JSON.parse(req.body.toString('utf8'));
      } catch (error) {
        console.error('Failed to parse webhook body:', error);
        return res.sendStatus(400);
      }

      console.log('Received end-of-call webhook:', {
        id: report.id,
        duration: report.durationSeconds,
        reason: report.endedReason,
      });

      // Build memory summary from transcript
      if (report.transcript || report.messages) {
        const summary = buildMemorySummary(report);
        callMemories.set(report.id, summary);
        console.log('Stored memory for call:', report.id);
      }

      // Download recording if available
      if (report.recordingUrl) {
        // In production, download and store the recording
        console.log('Recording available:', report.recordingUrl);
      }

      res.sendStatus(204);
    }
  );
}

function verifySignature(req: Request): boolean {
  const signature = req.get('x-alebex-signature');
  if (!signature) return false;

  // Parse signature: t=<timestamp>,v1=<hex>
  const parts = Object.fromEntries(
    signature.split(',').map(p => p.split('='))
  );

  const timestamp = parseInt(parts.t, 10);
  const receivedSig = parts.v1;

  // Check timestamp freshness (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    console.error('Webhook timestamp too old or in future');
    return false;
  }

  // req.body is a Buffer from express.raw
  if (!Buffer.isBuffer(req.body)) {
    console.error('Webhook body is not a Buffer');
    return false;
  }

  // Compute HMAC on the raw bytes
  const payload = `${timestamp}.${req.body.toString('utf8')}`;
  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Constant-time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch {
    return false;
  }
}

function buildMemorySummary(report: EndOfCallReport): string {
  // Extract key points from the conversation
  const messages = report.messages || [];
  
  // Simple summary: last few exchanges
  const recentMessages = messages.slice(-6);
  const summary = recentMessages
    .map(m => `${m.role}: ${m.text}`)
    .join('. ');

  return summary.substring(0, 500); // Keep it short
}
