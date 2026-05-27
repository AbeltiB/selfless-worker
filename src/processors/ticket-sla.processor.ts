import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES, TicketSlaJob } from 'selfless-sdk';
import { createRedisConnection } from '../redis';
import { config } from '../config';
import { logger } from '../logger';

export function startTicketSlaWorker(): Worker {
  const connection = createRedisConnection();

  const worker = new Worker<TicketSlaJob>(
    QUEUE_NAMES.TICKET_SLA,
    async (job: Job<TicketSlaJob>) => {
      const { ticketId, stepId, slaMinutes } = job.data;
      logger.info({ jobId: job.id, ticketId, stepId, slaMinutes }, 'Checking ticket SLA');

      // Fetch current ticket state from API
      const url = `${config.api.baseUrl}/api/v1/tickets/${ticketId}`;
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${process.env.WORKER_API_TOKEN || ''}` },
        });
      } catch (err) {
        logger.error({ jobId: job.id, ticketId, err }, 'Failed to fetch ticket for SLA check');
        throw err;
      }

      if (!response.ok) {
        logger.warn({ jobId: job.id, ticketId, status: response.status }, 'Ticket not found during SLA check, skipping');
        return { skipped: true };
      }

      const { data: ticket } = await response.json() as { data: any };

      // Only flag SLA breach if ticket is still on this step and waiting/in-service
      const activeStatuses = ['WAITING', 'IN_SERVICE', 'CALLED', 'ON_HOLD'];
      if (ticket.currentStepId !== stepId || !activeStatuses.includes(ticket.status)) {
        logger.info({ jobId: job.id, ticketId }, 'Ticket moved past step, SLA check skipped');
        return { skipped: true, reason: 'ticket advanced' };
      }

      // Emit SLA breach event via API
      const breachUrl = `${config.api.baseUrl}/api/v1/tickets/${ticketId}/sla-breach`;
      await fetch(breachUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WORKER_API_TOKEN || ''}` },
        body: JSON.stringify({ stepId, slaMinutes }),
      });

      logger.warn({ jobId: job.id, ticketId, stepId, slaMinutes }, 'SLA breach flagged');
      return { breached: true, ticketId, stepId };
    },
    { connection, concurrency: 5 },
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'SLA job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'SLA job failed'));

  return worker;
}
