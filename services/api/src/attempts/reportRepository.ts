export type ReportRecord = {
  id: string;
  evaluationResultId: string;
  reportedByUserId: string;
  reason: string;
};

export type ReportRepository = {
  insert(record: Omit<ReportRecord, 'id'>): Promise<ReportRecord>;
};

export class InMemoryReportRepository implements ReportRepository {
  private reports: ReportRecord[] = [];
  private nextId = 1;

  async insert(record: Omit<ReportRecord, 'id'>): Promise<ReportRecord> {
    const row: ReportRecord = { ...record, id: `report-${this.nextId++}` };
    this.reports.push(row);
    return row;
  }
}
