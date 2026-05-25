import { Worker, Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { QUEUE_NAMES, NotificationEmailJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { config } from '../config';
import { logger } from '../logger';

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
}

export function startEmailWorker(): Worker {
  const connection = createRedisConnection();
  const transporter = createTransporter();

  const worker = new Worker<NotificationEmailJob>(
    QUEUE_NAMES.NOTIFICATION_EMAIL,
    async (job: Job<NotificationEmailJob>) => {
      const { to, subject, body, html } = job.data;
      logger.info({ jobId: job.id, to, subject }, 'Sending email');

      if (!config.email.user || !config.email.pass) {
        logger.warn({ jobId: job.id }, 'Gmail not configured, skipping email send');
        return { skipped: true };
      }

      const info = await transporter.sendMail({
        from: `"SelfLess" <${config.email.from}>`,
        to,
        subject,
        text: body,
        html: html || `<p>${body.replace(/\n/g, '<br>')}</p>`,
      });

      logger.info({ jobId: job.id, messageId: info.messageId }, 'Email sent');
      return { messageId: info.messageId };
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 },
    },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Email job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Email job failed'));

  return worker;
}
