import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, AnalyticsAggregateJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';

export function startAnalyticsWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<AnalyticsAggregateJob>(
    QUEUE_NAMES.ANALYTICS_AGGREGATE,
    async (job: Job<AnalyticsAggregateJob>) => {
      const { branchId, serviceId, date, hour } = job.data;
      // Phase 1: log only (full analytics aggregation deferred to Phase 2)
      logger.info(
        { jobId: job.id, branchId, serviceId, date, hour },
        '[ANALYTICS STUB] Would aggregate analytics snapshot',
      );
      return { stub: true, branchId, serviceId, date, hour };
    },
    { connection, concurrency: 2 },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Analytics job completed'));
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'Analytics job failed'),
  );
  return worker;
}
