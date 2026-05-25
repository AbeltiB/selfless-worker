import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, NotificationPushJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';

export function startPushWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<NotificationPushJob>(
    QUEUE_NAMES.NOTIFICATION_PUSH,
    async (job: Job<NotificationPushJob>) => {
      const { token, title, body } = job.data;
      // Phase 1: log only (FCM integration deferred to Phase 2)
      logger.info(
        { jobId: job.id, token: token.substring(0, 20) + '...', title, body: body.substring(0, 50) },
        '[PUSH STUB] Would send push notification',
      );
      return { stub: true, token, title };
    },
    { connection, concurrency: 5 },
  );

  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'Push notification job failed'),
  );
  return worker;
}
