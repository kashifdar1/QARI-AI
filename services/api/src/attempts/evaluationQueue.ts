export type EvaluationQueue = {
  enqueue(attemptId: string): Promise<void>;
};

/** Test/dev default — records enqueued ids in memory, nothing actually runs. */
export class InMemoryEvaluationQueue implements EvaluationQueue {
  enqueued: string[] = [];

  async enqueue(attemptId: string): Promise<void> {
    this.enqueued.push(attemptId);
  }
}
