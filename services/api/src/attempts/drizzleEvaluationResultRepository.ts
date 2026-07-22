import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { evaluationResults, issueCandidates, wordSegments } from '../db/schema/index.js';
import type {
  EvaluationResultRecord,
  EvaluationResultRepository,
  NewEvaluationResult,
} from './evaluationResultRepository.js';

export class DrizzleEvaluationResultRepository implements EvaluationResultRepository {
  constructor(private readonly db: Db) {}

  async insert(record: NewEvaluationResult): Promise<EvaluationResultRecord> {
    const [row] = await this.db
      .insert(evaluationResults)
      .values({
        attemptId: record.attemptId,
        modelBundleVersion: record.modelBundleVersion,
        contentVersionId: record.contentVersionId,
        status: record.status,
        audioQualityFailureReasons: record.audioQualityFailureReasons,
        audioQualityDurationSeconds: record.audioQualityDurationSeconds,
      })
      .returning();
    if (!row) throw new Error('Evaluation result insert returned no row');

    if (record.wordSegments.length > 0) {
      await this.db.insert(wordSegments).values(
        record.wordSegments.map((w) => ({
          evaluationResultId: row.id,
          wordIndex: w.wordIndex,
          startMs: w.startMs,
          endMs: w.endMs,
        })),
      );
    }
    if (record.issueCandidates.length > 0) {
      await this.db.insert(issueCandidates).values(
        record.issueCandidates.map((c) => ({
          evaluationResultId: row.id,
          wordIndex: c.wordIndex,
          kind: c.kind,
          modelConfidence: c.modelConfidence,
        })),
      );
    }

    return { ...record, id: row.id };
  }

  async findLatestForAttempt(attemptId: string): Promise<EvaluationResultRecord | null> {
    const [row] = await this.db
      .select()
      .from(evaluationResults)
      .where(eq(evaluationResults.attemptId, attemptId))
      .orderBy(desc(evaluationResults.createdAt))
      .limit(1);
    if (!row) return null;

    const segments = await this.db
      .select()
      .from(wordSegments)
      .where(eq(wordSegments.evaluationResultId, row.id));
    const issues = await this.db
      .select()
      .from(issueCandidates)
      .where(eq(issueCandidates.evaluationResultId, row.id));

    return {
      id: row.id,
      attemptId: row.attemptId,
      modelBundleVersion: row.modelBundleVersion,
      contentVersionId: row.contentVersionId,
      status: row.status,
      audioQualityFailureReasons: row.audioQualityFailureReasons,
      audioQualityDurationSeconds: row.audioQualityDurationSeconds,
      wordSegments: segments.map((s) => ({ wordIndex: s.wordIndex, startMs: s.startMs, endMs: s.endMs })),
      issueCandidates: issues.map((c) => ({
        wordIndex: c.wordIndex,
        kind: c.kind,
        modelConfidence: c.modelConfidence,
      })),
    };
  }
}
