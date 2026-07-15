import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, AnalyticsAggregateJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { logger } from '../logger';

export function startAnalyticsWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<AnalyticsAggregateJob>(
    QUEUE_NAMES.ANALYTICS_AGGREGATE,
    async (job: Job<AnalyticsAggregateJob>) => {
      const { organizationId, branchId, serviceId } = job.data;
      // Repeatable cron jobs carry the same static `data` on every run, so date/hour must be
      // computed from wall-clock time here rather than trusted from job.data.
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const hour = now.getUTCHours();
      // Phase 1: log only (full analytics aggregation deferred to Phase 2)
      logger.info(
        { jobId: job.id, organizationId, branchId, serviceId, date, hour },
        '[ANALYTICS STUB] Would aggregate analytics snapshot',
      );
      return { stub: true, organizationId, branchId, serviceId, date, hour };
    },
    { connection, concurrency: 2 },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Analytics job completed'));
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'Analytics job failed'),
  );
  return worker;
}
