import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, NotificationSmsJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';

export function startSmsWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<NotificationSmsJob>(
    QUEUE_NAMES.NOTIFICATION_SMS,
    async (job: Job<NotificationSmsJob>) => {
      const { to, body } = job.data;
      // Phase 1: log only (Twilio integration deferred to Phase 2)
      logger.info({ jobId: job.id, to, body: body.substring(0, 50) }, '[SMS STUB] Would send SMS');
      return { stub: true, to, body };
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'SMS job failed'));
  return worker;
}
