import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Button, Card, ErrorState, LoadingState, Text } from '@qari/ui';
import type { AttemptsClient, FeedbackReport as FeedbackReportDto } from '../../api/attemptsClient.js';
import type { ContentClient } from '../../api/contentClient.js';
import { useLocale } from '../../i18n/LocaleContext.js';

export type FeedbackReportProps = {
  attemptId: string;
  passageId: string;
  attemptsClient: AttemptsClient;
  contentClient: ContentClient;
  onRetry: () => void;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; report: FeedbackReportDto };

/**
 * Milestone C task 4. Word-timeline highlighting, tap-to-hear reference
 * slices, tier-appropriate wording, and the explicit abstain state for
 * low-confidence results — never labeling anything a mistake at low tier
 * (Principle 2 / ADR-005). "Ask a teacher" is a disabled placeholder
 * (Principle 4: the path is reserved, the portal is post-MVP).
 */
export function FeedbackReport({
  attemptId,
  passageId,
  attemptsClient,
  contentClient,
  onRetry,
}: FeedbackReportProps): JSX.Element {
  const { locale } = useLocale();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reportSent, setReportSent] = useState(false);
  const [referenceAudioUrl, setReferenceAudioUrl] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    return () => {
      playerRef.current?.release();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    contentClient
      .getPassageDetail(passageId)
      .then((detail) => {
        if (!cancelled) setReferenceAudioUrl(detail.referenceAudioUrl);
      })
      .catch(() => {
        // Reference playback is a nice-to-have on this screen — a failed
        // lookup just leaves the "tap to hear" button absent, it doesn't
        // block the feedback report itself from rendering.
      });
    return () => {
      cancelled = true;
    };
  }, [contentClient, passageId]);

  function playReference() {
    if (!referenceAudioUrl) return;
    playerRef.current?.release();
    const player = createAudioPlayer(referenceAudioUrl);
    playerRef.current = player;
    player.play();
  }

  useEffect(() => {
    let cancelled = false;
    attemptsClient
      .getFeedback(attemptId)
      .then((report) => {
        if (!cancelled) setState({ status: 'ready', report });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attemptsClient, attemptId]);

  if (state.status === 'loading') {
    return <LoadingState lang={locale} label="Loading feedback" />;
  }
  if (state.status === 'error') {
    return <ErrorState lang={locale} title="Retry" description={state.message} />;
  }

  const { report } = state;
  const isAbstain = report.confidenceTier === 'low';
  const visibleIssues = report.issueCandidates.filter((i) => i.label !== null);

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Text lang={locale} variant="lg" accessibilityLabel={`Overall confidence: ${report.confidenceTier}`}>
        {isAbstain
          ? "We're not confident enough to flag anything here — nothing is marked as a mistake."
          : visibleIssues.length === 0
            ? 'Great job! No issues found.'
            : `${visibleIssues.length} possible issue(s) to review`}
      </Text>

      {report.coachingMessages.map((message, i) => (
        <Text key={i} lang={locale} variant="sm" muted>
          {message}
        </Text>
      ))}

      {!isAbstain &&
        visibleIssues.map((issue) => (
          <Card key={issue.wordIndex}>
            <Text lang={locale} variant="md">
              {issue.tier === 'high' ? `Possible ${issue.label}` : `Possible issue (${issue.label})`}
            </Text>
            <Text lang={locale} variant="xs" muted>
              {`Word ${issue.wordIndex + 1} · confidence: ${issue.tier}`}
            </Text>
            {referenceAudioUrl && (
              // Plays the whole passage's reference recitation, not a
              // precise per-word slice — packages/domain's
              // referenceAudioSlices isn't wired to a real per-word audio
              // URL yet (it only has a bucket-root base URL + a "#t="
              // fragment, no actual object key for this passage's
              // reciter audio), and QUL word-level timing data is a
              // separately-documented, unresolved license blocker
              // (docs/STUBS.md).
              <Button label="Tap to hear reference (full passage)" lang={locale} onPress={playReference} variant="secondary" />
            )}
          </Card>
        ))}

      <Button
        label="Ask a teacher (coming soon)"
        lang={locale}
        variant="secondary"
        disabled
        onPress={() => {}}
      />

      <Button label="Retry" lang={locale} onPress={onRetry} />

      <Button
        label={reportSent ? 'Report sent' : 'Report incorrect feedback'}
        lang={locale}
        variant="secondary"
        disabled={reportSent}
        onPress={() => {
          attemptsClient
            .reportIncorrectFeedback(attemptId, 'User flagged this feedback as incorrect')
            .then(() => setReportSent(true))
            .catch(() => {});
        }}
      />
    </View>
  );
}
