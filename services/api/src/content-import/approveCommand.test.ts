import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ApproveError, approveContentVersion } from './approveCommand.js';
import { InMemoryContentRepository } from './contentRepository.js';
import { importTanzilContent } from './importCommand.js';

const TEXT_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-uthmani-v1.1.txt', import.meta.url),
);
const METADATA_PATH = fileURLToPath(
  new URL('../../../../content-import/sources/tanzil-quran-metadata-v1.0.xml', import.meta.url),
);

async function importedVersion(repo: InMemoryContentRepository) {
  return (await importTanzilContent(repo, TEXT_PATH, METADATA_PATH)).contentVersion;
}

describe('approveContentVersion', () => {
  it('transitions imported -> approved and records who approved it', async () => {
    const repo = new InMemoryContentRepository();
    const version = await importedVersion(repo);

    const approved = await approveContentVersion(repo, version.id, 'Reviewer Name');
    expect(approved.reviewStatus).toBe('approved');
    expect(approved.reviewedBy).toBe('Reviewer Name');
    expect(approved.reviewedAt).toBeInstanceOf(Date);
  });

  it('writes an AuditEvent for the approval', async () => {
    const repo = new InMemoryContentRepository();
    const version = await importedVersion(repo);
    await approveContentVersion(repo, version.id, 'Reviewer Name');
    expect(repo.auditEvents).toContainEqual(
      expect.objectContaining({
        eventType: 'content_version.approved',
        subjectType: 'quran_content_version',
        subjectId: version.id,
        metadata: { reviewerName: 'Reviewer Name' },
      }),
    );
  });

  it('only an approved version becomes servable (findApprovedContentVersion)', async () => {
    const repo = new InMemoryContentRepository();
    const version = await importedVersion(repo);
    expect(await repo.findApprovedContentVersion()).toBeNull();
    await approveContentVersion(repo, version.id, 'Reviewer Name');
    expect((await repo.findApprovedContentVersion())?.id).toBe(version.id);
  });

  it('rejects approving an unknown version id', async () => {
    const repo = new InMemoryContentRepository();
    await expect(approveContentVersion(repo, 'nonexistent', 'Reviewer')).rejects.toThrow(
      ApproveError,
    );
  });

  it('rejects approving a version that is already approved (no automated re-approval)', async () => {
    const repo = new InMemoryContentRepository();
    const version = await importedVersion(repo);
    await approveContentVersion(repo, version.id, 'Reviewer Name');
    await expect(approveContentVersion(repo, version.id, 'Someone Else')).rejects.toThrow(
      ApproveError,
    );
  });

  it('rejects an empty reviewer name (approval must be attributable to a human)', async () => {
    const repo = new InMemoryContentRepository();
    const version = await importedVersion(repo);
    await expect(approveContentVersion(repo, version.id, '   ')).rejects.toThrow(ApproveError);
  });
});
