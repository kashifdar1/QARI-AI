import type { WordSegment, RawIssueCandidate } from '@qari/domain';

export type EvaluationResultRecord = {
  id: string;
  attemptId: string;
  modelBundleVersion: string;
  contentVersionId: string;
  status: 'completed' | 'needs_rerecord' | 'failed';
  audioQualityFailureReasons: string[];
  audioQualityDurationSeconds: number;
  wordSegments: WordSegment[];
  issueCandidates: RawIssueCandidate[];
};

export type NewEvaluationResult = Omit<EvaluationResultRecord, 'id'>;

export type EvaluationResultRepository = {
  insert(record: NewEvaluationResult): Promise<EvaluationResultRecord>;
  findLatestForAttempt(attemptId: string): Promise<EvaluationResultRecord | null>;
};

export class InMemoryEvaluationResultRepository implements EvaluationResultRepository {
  private results: EvaluationResultRecord[] = [];
  private nextId = 1;

  async insert(record: NewEvaluationResult): Promise<EvaluationResultRecord> {
    const row: EvaluationResultRecord = { ...record, id: `eval-result-${this.nextId++}` };
    this.results.push(row);
    return row;
  }

  async findLatestForAttempt(attemptId: string): Promise<EvaluationResultRecord | null> {
    const matches = this.results.filter((r) => r.attemptId === attemptId);
    return matches.at(-1) ?? null;
  }
}
