export type Attempt = {
  id: string;
  sessionId: string;
  status: string;
  retentionState: string;
  objectKey: string | null;
  teacherReviewAvailable: boolean;
};

export type FeedbackReport = {
  evaluationStatus: 'completed' | 'needs_rerecord' | 'failed';
  passageVersion: string;
  modelBundleVersion: string;
  audioQuality: { passed: boolean; durationSeconds: number; failureReasons: string[] };
  wordSegments: Array<{ wordIndex: number; startMs: number; endMs: number }>;
  issueCandidates: Array<{ wordIndex: number; tier: 'high' | 'medium' | 'low'; label: string | null }>;
  confidenceTier: 'high' | 'medium' | 'low';
  coachingMessages: string[];
  referenceAudioSlices: Array<{ wordIndexStart: number; wordIndexEnd: number; audioUrl: string }>;
  retryRecommendation: 'not_needed' | 'recommended' | 'required';
  teacherReviewAvailable: boolean;
};

/**
 * Typed client for the attempt lifecycle + evaluation endpoints
 * (packages/api-contracts/openapi.yaml, services/api/src/attempts). Bearer
 * auth required for every call here (unlike ContentClient).
 */
export class AttemptsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getAccessToken: () => string,
  ) {}

  private authHeaders(): Record<string, string> {
    return { authorization: `Bearer ${this.getAccessToken()}` };
  }

  async createAttempt(sessionId: string, clientAttemptId: string, idempotencyKey: string): Promise<Attempt> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/attempts`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify({ clientAttemptId }),
    });
    if (!response.ok) throw new Error(`Failed to create attempt (${response.status})`);
    return (await response.json()) as Attempt;
  }

  async createUploadUrl(attemptId: string, sizeBytes: number): Promise<{ url: string; objectKey: string }> {
    const response = await fetch(`${this.baseUrl}/attempts/${attemptId}/upload-url`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ contentType: 'audio/wav', sizeBytes }),
    });
    if (!response.ok) throw new Error(`Failed to get upload URL (${response.status})`);
    return (await response.json()) as { url: string; objectKey: string };
  }

  async completeAttempt(attemptId: string): Promise<Attempt> {
    const response = await fetch(`${this.baseUrl}/attempts/${attemptId}/complete`, {
      method: 'POST',
      headers: this.authHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to complete attempt (${response.status})`);
    return (await response.json()) as Attempt;
  }

  async getEvaluationStatus(attemptId: string): Promise<{ status: string }> {
    const response = await fetch(`${this.baseUrl}/attempts/${attemptId}/evaluation`, {
      headers: this.authHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to poll evaluation status (${response.status})`);
    return (await response.json()) as { status: string };
  }

  async getFeedback(attemptId: string): Promise<FeedbackReport> {
    const response = await fetch(`${this.baseUrl}/attempts/${attemptId}/feedback`, {
      headers: this.authHeaders(),
    });
    if (!response.ok) throw new Error(`Failed to fetch feedback (${response.status})`);
    return (await response.json()) as FeedbackReport;
  }

  async reportIncorrectFeedback(attemptId: string, reason: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/attempts/${attemptId}/report`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!response.ok) throw new Error(`Failed to submit report (${response.status})`);
  }
}
