import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { EvaluationQueue } from './evaluationQueue.js';

export const EVALUATION_QUEUE_NAME = 'evaluation';

export type EvaluationJobData = {
  attemptId: string;
};

/**
 * Real BullMQ-backed queue. Requires a running Redis instance
 * (infrastructure/docker/docker-compose.yml) — no Redis is available in
 * this development environment, so this class is untested here (unlike
 * InMemoryEvaluationQueue, which every route test uses); see the
 * milestone risk notes.
 */
export class BullMqEvaluationQueue implements EvaluationQueue {
  private readonly queue: Queue<EvaluationJobData>;

  constructor(redisUrl: string) {
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<EvaluationJobData>(EVALUATION_QUEUE_NAME, { connection });
  }

  async enqueue(attemptId: string): Promise<void> {
    await this.queue.add('evaluate-attempt', { attemptId });
  }
}
