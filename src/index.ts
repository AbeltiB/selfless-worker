import 'dotenv/config';
import { startEmailWorker } from './processors/email.processor';
import { startSmsWorker } from './processors/sms.processor';
import { startPushWorker } from './processors/push.processor';
import { startWhatsAppWorker } from './processors/whatsapp.processor';
import { startTicketExpiryWorker } from './processors/ticket-expiry.processor';
import { startAnalyticsWorker } from './processors/analytics.processor';
import { logger } from './logger';

logger.info('SelfLess Worker starting...');

const workers = [
  startEmailWorker(),
  startSmsWorker(),
  startPushWorker(),
  startWhatsAppWorker(),
  startTicketExpiryWorker(),
  startAnalyticsWorker(),
];

logger.info(`${workers.length} workers started`);

const shutdown = async () => {
  logger.info('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
