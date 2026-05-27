import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, NotificationSmsJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';

// WhatsApp re-uses the SMS queue/job type for now; Twilio handles both channels
export function startWhatsAppWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<NotificationSmsJob>(
    QUEUE_NAMES.NOTIFICATION_SMS,
    async (job: Job<NotificationSmsJob>) => {
      const { to, body } = job.data;

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

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
          logger.info({ jobId: job.id, messageSid: result.sid }, 'WhatsApp sent via Twilio');
          return { sent: true, messageSid: result.sid };
        } catch (err) {
          logger.error({ jobId: job.id, err }, 'Failed to send WhatsApp via Twilio');
          throw err;
        }
      }

      logger.info({ jobId: job.id, to }, '[WHATSAPP STUB] No Twilio credentials, skipping');
      return { stub: true, to };
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'WhatsApp job failed'),
  );
  return worker;
}
