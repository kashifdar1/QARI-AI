import type { ContentRepository, ContentVersionRecord } from './contentRepository.js';

export class ApproveError extends Error {}

/**
 * `imported -> approved` (ADR-003). Only an approved version is servable
 * by the content API; only a human reviewer name flowing through here (not
 * an automated process) may set it, and the transition is always recorded
 * as an AuditEvent.
 */
export async function approveContentVersion(
  repo: ContentRepository,
  versionId: string,
  reviewerName: string,
): Promise<ContentVersionRecord> {
  if (reviewerName.trim().length === 0) {
    throw new ApproveError('A reviewer name is required to approve a content version');
  }
  const existing = await repo.findContentVersion(versionId);
  if (!existing) {
    throw new ApproveError(`No content version with id ${versionId}`);
  }
  if (existing.reviewStatus !== 'imported') {
    throw new ApproveError(
      `Content version ${versionId} is "${existing.reviewStatus}", not "imported" — cannot approve`,
    );
  }

  const approved = await repo.approveContentVersion(versionId, reviewerName);

  await repo.recordAuditEvent({
    eventType: 'content_version.approved',
    subjectType: 'quran_content_version',
    subjectId: versionId,
    metadata: { reviewerName },
  });

  return approved;
}
