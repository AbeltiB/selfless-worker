import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, NotificationTelegramJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';

const TELEGRAM_API = 'https://api.telegram.org';

async function sendTelegramMessage(botToken: string, chatId: string, text: string, parseMode = 'Markdown') {
  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }

  return res.json();
}

export function startTelegramWorker(): Worker {
  const connection = createRedisConnection();
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  const worker = new Worker<NotificationTelegramJob>(
    QUEUE_NAMES.NOTIFICATION_TELEGRAM,
    async (job: Job<NotificationTelegramJob>) => {
      const { telegramId, message } = job.data;

      if (!botToken) {
        logger.warn({ jobId: job.id }, 'TELEGRAM_BOT_TOKEN not set, skipping');
        return { skipped: true };
      }

      logger.info({ jobId: job.id, telegramId }, 'Sending Telegram message');
      const result = await sendTelegramMessage(botToken, telegramId, message) as any;
      logger.info({ jobId: job.id, messageId: result?.result?.message_id }, 'Telegram message sent');
      return { messageId: result?.result?.message_id };
    },
    {
      connection,
      concurrency: 20,
      limiter: { max: 30, duration: 1000 },
    },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Telegram job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Telegram job failed'));

  return worker;
}
