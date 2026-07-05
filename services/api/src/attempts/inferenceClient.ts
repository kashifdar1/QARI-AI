export type InferenceWordSegment = { word_index: number; start_ms: number; end_ms: number };
export type InferenceIssueCandidate = { word_index: number; kind: string; model_confidence: number };
export type InferenceAudioQuality = {
  passed: boolean;
  duration_seconds: number;
  silence_ratio: number;
  clipped_sample_ratio: number;
  estimated_snr_db: number;
  failure_reasons: string[];
};

export type InferenceEvaluateResponse = {
  attempt_id: string;
  model_bundle_version: string;
  status: 'completed' | 'needs_rerecord';
  audio_quality: InferenceAudioQuality;
  word_segments: InferenceWordSegment[];
  issue_candidates: InferenceIssueCandidate[];
};

export type InferenceClient = {
  evaluate(attemptId: string, targetWords: string[], audioBase64: string): Promise<InferenceEvaluateResponse>;
};

export class InferenceRequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

/** Real HTTP client — services/inference (real ASR checkpoint, no stub) is a separate process. */
export class HttpInferenceClient implements InferenceClient {
  constructor(private readonly baseUrl: string) {}

  async evaluate(
    attemptId: string,
    targetWords: string[],
    audioBase64: string,
  ): Promise<InferenceEvaluateResponse> {
    const response = await fetch(`${this.baseUrl}/v1/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ attempt_id: attemptId, target_words: targetWords, audio_base64: audioBase64 }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new InferenceRequestError(response.status, `Inference request failed: ${body}`);
    }
    return (await response.json()) as InferenceEvaluateResponse;
  }
}
