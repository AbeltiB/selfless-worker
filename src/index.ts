import 'dotenv/config';
import { startEmailWorker } from './processors/email.processor';
import { startSmsWorker } from './processors/sms.processor';
import { startPushWorker } from './processors/push.processor';
import { startWhatsAppWorker } from './processors/whatsapp.processor';
import { startTicketExpiryWorker } from './processors/ticket-expiry.processor';
import { startAnalyticsWorker } from './processors/analytics.processor';
import { startTelegramWorker } from './processors/telegram.processor';
import { startTicketSlaWorker } from './processors/ticket-sla.processor';
import { startHealthServer } from './health';
import { logger } from './logger';

logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
logger.info('  SelfLess Worker  |  starting up');
logger.info(`  Node ${process.version}  |  ${process.env.NODE_ENV ?? 'development'}`);
logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const workerDefs: Array<{ name: string; start: () => { close: () => Promise<void> } }> = [
  { name: 'Email',          start: startEmailWorker },
  { name: 'SMS',            start: startSmsWorker },
  { name: 'Push',           start: startPushWorker },
  { name: 'WhatsApp',       start: startWhatsAppWorker },
  { name: 'Telegram',       start: startTelegramWorker },
  { name: 'TicketExpiry',   start: startTicketExpiryWorker },
  { name: 'TicketSLA',      start: startTicketSlaWorker },
  { name: 'Analytics',      start: startAnalyticsWorker },
];

const workers = workerDefs.map(({ name, start }) => {
  const w = start();
  logger.info(`  [+] ${name} worker listening`);
  return w;
});

logger.info(`${workers.length}/${workerDefs.length} workers started`);

startHealthServer(workers.length);

logger.info('Ready — waiting for jobs');
logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const shutdown = async () => {
  logger.info('SIGTERM received — shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  logger.info('All workers closed. Goodbye.');
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
