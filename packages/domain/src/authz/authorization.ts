/**
 * Object-level authorization predicates (CLAUDE.md §5: "write tests that
 * prove a guardian cannot access another family's child and a user cannot
 * fetch another user's attempt"). Pure and framework-free so the same rule
 * is enforced identically wherever it's checked — services/api wraps this
 * in an HTTP 403 at the route layer; nothing else is allowed to encode its
 * own copy of "who can see this profile."
 */

export type ProfileAccessContext = {
  ownerUserId: string;
  /** Additional guardians via GuardianRelationship (co-managed profiles, post-MVP). */
  guardianUserIds?: string[];
};

export function canAccessProfile(actorUserId: string, profile: ProfileAccessContext): boolean {
  return actorUserId === profile.ownerUserId || (profile.guardianUserIds ?? []).includes(actorUserId);
}

/**
 * A PracticeSession/Attempt/EvaluationResult/etc. is only accessible
 * through the profile that owns it — same rule, named separately so call
 * sites read as "what am I checking access to," not just "call the profile
 * check again."
 */
export function canAccessProfileOwnedResource(
  actorUserId: string,
  profile: ProfileAccessContext,
): boolean {
  return canAccessProfile(actorUserId, profile);
}
