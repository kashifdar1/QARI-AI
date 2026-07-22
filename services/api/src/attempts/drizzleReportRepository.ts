import { contentIssueReports } from '../db/schema/index.js';
import type { Db } from '../db/client.js';
import type { ReportRecord, ReportRepository } from './reportRepository.js';

export class DrizzleReportRepository implements ReportRepository {
  constructor(private readonly db: Db) {}

  async insert(record: Omit<ReportRecord, 'id'>): Promise<ReportRecord> {
    const [row] = await this.db
      .insert(contentIssueReports)
      .values({
        evaluationResultId: record.evaluationResultId,
        reportedByUserId: record.reportedByUserId,
        reason: record.reason,
      })
      .returning();
    if (!row) throw new Error('Report insert returned no row');
    return {
      id: row.id,
      evaluationResultId: row.evaluationResultId,
      reportedByUserId: row.reportedByUserId,
      reason: row.reason,
    };
  }
}
