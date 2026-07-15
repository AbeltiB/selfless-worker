import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, TicketExpiryJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { config } from '../config';
import { logger } from '../logger';

export function startTicketExpiryWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<TicketExpiryJob>(
    QUEUE_NAMES.TICKET_EXPIRY,
    async (job: Job<TicketExpiryJob>) => {
      const { ticketId } = job.data;
      logger.info({ jobId: job.id, ticketId }, 'Processing ticket expiry');

      const url = `${config.api.baseUrl}/api/v1/tickets/${ticketId}/expire`;

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-service-token': config.api.serviceToken },
        });
      } catch (err) {
        logger.error({ jobId: job.id, ticketId, err }, 'Failed to reach API for ticket expiry');
        throw err;
      }

      if (response.status === 404) {
        logger.warn({ jobId: job.id, ticketId }, 'Ticket not found, skipping expiry');
        return { skipped: true, reason: 'not found' };
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      // 200 covers both "expired" and "skipped: already moved on" — the API's /expire route is
      // idempotent, both are a successful job completion, not a retry-worthy failure.
      const body = await response.json() as { skipped?: boolean; reason?: string; expired?: boolean };
      if (body.skipped) {
        logger.info({ jobId: job.id, ticketId, reason: body.reason }, 'Ticket already moved on, skipping expiry');
        return { skipped: true, reason: body.reason };
      }

      logger.info({ jobId: job.id, ticketId }, 'Ticket expired successfully');
      return { expired: true, ticketId };
    },
    { connection, concurrency: 10 },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'Ticket expiry job completed'));
  worker.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, err: err.message }, 'Ticket expiry job failed'),
  );
  return worker;
}
