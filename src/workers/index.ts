/**
 * ONE Engine Background Workers
 * Cron jobs for AI strategy, PnL settlement, and data sync
 */

import { CronJob } from 'cron';
import { logger } from '@/lib/logger';
import { runAIStrategy } from './ai-strategy.worker';
import { runPnlSettlement } from './pnl-settlement.worker';
import { runDataSync } from './data-sync.worker';
import { env } from '@/config/env';

const log = logger.child({ service: 'WorkerManager' });

// Worker registry
const workers: Map<string, CronJob> = new Map();

/**
 * Initialize and start all workers
 */
export function startWorkers(): void {
  log.info('Starting background workers');

  // AI Strategy Runner - Every hour
  if (env.ENABLE_AI_QUANT) {
    workers.set(
      'ai-strategy',
      new CronJob('0 * * * *', async () => {
        log.info('Running AI strategy worker');
        try {
          await runAIStrategy();
        } catch (error) {
          log.error({ error }, 'AI strategy worker failed');
        }
      })
    );
  }

  // PnL Settlement - Daily at midnight UTC
  if (env.ENABLE_AI_QUANT) {
    workers.set(
      'pnl-settlement',
      new CronJob('0 0 * * *', async () => {
        log.info('Running PnL settlement worker');
        try {
          await runPnlSettlement();
        } catch (error) {
          log.error({ error }, 'PnL settlement worker failed');
        }
      })
    );
  }

  // Data Sync - Every 5 minutes
  if (env.ENABLE_TRADING) {
    workers.set(
      'data-sync',
      new CronJob('*/5 * * * *', async () => {
        log.info('Running data sync worker');
        try {
          await runDataSync();
        } catch (error) {
          log.error({ error }, 'Data sync worker failed');
        }
      })
    );
  }

  // Start all registered workers
  workers.forEach((job, name) => {
    job.start();
    log.info(`Started worker: ${name}`);
  });
}

/**
 * Stop all workers
 */
export function stopWorkers(): void {
  log.info('Stopping background workers');

  workers.forEach((job, name) => {
    job.stop();
    log.info(`Stopped worker: ${name}`);
  });

  workers.clear();
}

/**
 * Get worker status
 */
export function getWorkerStatus(): Array<{
  name: string;
  running: boolean;
  lastRun?: Date;
  nextRun?: Date;
}> {
  return Array.from(workers.entries()).map(([name, job]) => ({
    name,
    running: job.running,
    lastRun: job.lastDate() as Date | undefined,
    nextRun: job.nextDate()?.toJSDate(),
  }));
}
