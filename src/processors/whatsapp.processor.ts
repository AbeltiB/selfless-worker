import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, NotificationWhatsAppJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';

export function startWhatsAppWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<NotificationWhatsAppJob>(
    QUEUE_NAMES.NOTIFICATION_WHATSAPP,
    async (job: Job<NotificationWhatsAppJob>) => {
      const { to, body } = job.data;

      // If Twilio credentials are present, attempt to send via Twilio WhatsApp Sandbox
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default

      if (accountSid && authToken) {
        logger.info({ jobId: job.id, to }, 'Sending WhatsApp via Twilio');
        try {
          const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
          const params = new URLSearchParams({
            From: fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`,
            To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
            Body: body,
          });

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
            },
            body: params.toString(),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Twilio API error ${response.status}: ${errorText}`);
          }

          const result = (await response.json()) as { sid: string };
          logger.info({ jobId: job.id, messageSid: result.sid }, 'WhatsApp message sent via Twilio');
          return { sent: true, messageSid: result.sid };
        } catch (err) {
          logger.error({ jobId: job.id, err }, 'Failed to send WhatsApp via Twilio');
          throw err;
        }
      }

      // Phase 1 fallback: log only (Twilio/Meta integration deferred to Phase 2)
      logger.info(
        { jobId: job.id, to, body: body.substring(0, 50) },
        '[WHATSAPP STUB] Would send WhatsApp message',
      );
      return { stub: true, to, body };
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'WhatsApp job failed'),
  );
  return worker;
}
