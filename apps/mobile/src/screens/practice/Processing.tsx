import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, LoadingState, Text } from '@qari/ui';
import type { AttemptsClient } from '../../api/attemptsClient.js';
import { useLocale } from '../../i18n/LocaleContext.js';

export type ProcessingProps = {
  attemptId: string;
  attemptsClient: AttemptsClient;
  onDone: (status: string) => void;
  onCancel: () => void;
  pollIntervalMs?: number;
};

const TERMINAL_STATUSES = new Set(['completed', 'needs_rerecord', 'failed']);

/** Milestone C task 4: processing screen with cancel, polling GET /v1/attempts/:id/evaluation. */
export function Processing({ attemptId, attemptsClient, onDone, onCancel, pollIntervalMs = 2000 }: ProcessingProps): JSX.Element {
  const { locale } = useLocale();
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (cancelledRef.current) return;
      try {
        const { status } = await attemptsClient.getEvaluationStatus(attemptId);
        if (TERMINAL_STATUSES.has(status)) {
          onDone(status);
          return;
        }
      } catch {
        // transient poll failure — keep trying until cancelled
      }
      timer = setTimeout(poll, pollIntervalMs);
    }
    void poll();
    return () => clearTimeout(timer);
  }, [attemptId]);

  function handleCancel() {
    cancelledRef.current = true;
    setCancelled(true);
    onCancel();
  }

  if (cancelled) {
    return (
      <View style={{ padding: 16 }}>
        <Text lang={locale} variant="md">
          Cancelled
        </Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <LoadingState lang={locale} label="Evaluating your recitation..." />
      <Button label="Cancel" lang={locale} onPress={handleCancel} variant="secondary" />
    </View>
  );
}
