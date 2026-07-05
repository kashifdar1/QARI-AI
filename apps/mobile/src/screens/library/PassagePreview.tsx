import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, ErrorState, LoadingState, Text } from '@qari/ui';
import type { ContentClient, PassageDetail } from '../../api/contentClient.js';
import { useLocale } from '../../i18n/LocaleContext.js';

export type PassagePreviewProps = {
  passageId: string;
  contentClient: ContentClient;
  onStartPractice: () => void;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; passage: PassageDetail };

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25] as const;

const RIWAYAH_LABEL: Record<string, string> = { hafs_an_asim: "Hafs 'an 'Asim" };

/**
 * Canonical Arabic rendering + reference-audio controls (Milestone B task
 * 4). Playback itself (ADR-006: expo-audio, pitch-corrected rate change)
 * is not wired to a real player here — `referenceAudioUrl` currently
 * always points at the silent PLACEHOLDER_AUDIO stub (docs/STUBS.md), and
 * expo-audio's exact SDK-52 version hasn't been installed/verified in this
 * environment (no simulator). The speed control below is real UI state
 * that a real player integration will consume once expo-audio is added.
 */
export function PassagePreview({ passageId, contentClient, onStartPractice }: PassagePreviewProps): JSX.Element {
  const { locale, t } = useLocale();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [translationVisible, setTranslationVisible] = useState(false);
  const [verseRange, setVerseRange] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    contentClient
      .getPassageDetail(passageId)
      .then((passage) => {
        if (!cancelled) {
          setState({ status: 'ready', passage });
          setVerseRange({ start: passage.ayahStart, end: passage.ayahEnd });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contentClient, passageId]);

  if (state.status === 'loading') {
    return <LoadingState lang={locale} label="Loading passage" />;
  }
  if (state.status === 'error') {
    return <ErrorState lang={locale} title={t('common.retry')} description={state.message} />;
  }

  const { passage } = state;

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <View accessibilityRole="text" style={{ flexDirection: 'row', gap: 8 }}>
        <Text lang="en" variant="sm">
          {RIWAYAH_LABEL[passage.riwayah]}
        </Text>
      </View>

      {passage.ayahs.map((ayah) => (
        <View key={ayah.ayahNumber} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Text lang="ar" variant="arabic-reader">
            {ayah.words.map((w) => w.displayText).join(' ')}
          </Text>
          <Text lang="en" variant="xs" muted>
            {`(${ayah.ayahNumber})`}
          </Text>
        </View>
      ))}

      <View>
        <Text lang={locale} variant="sm">
          {passage.translation.available ? 'Translation' : 'Translation unavailable'}
        </Text>
        {!passage.translation.available && (
          <Text lang={locale} variant="xs" muted>
            No licensed translation is available for this passage yet.
          </Text>
        )}
        {passage.translation.available && (
          <Button
            label={translationVisible ? 'Hide translation' : 'Show translation'}
            lang={locale}
            onPress={() => setTranslationVisible((v) => !v)}
          />
        )}
      </View>

      <View accessibilityRole="adjustable" accessibilityLabel="Playback speed">
        <Text lang={locale} variant="sm">
          {`Speed: ${speed}x`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SPEED_OPTIONS.map((option) => (
            <Button
              key={option}
              label={`${option}x`}
              lang="en"
              variant={option === speed ? 'primary' : 'secondary'}
              onPress={() => setSpeed(option)}
            />
          ))}
        </View>
      </View>

      {verseRange && (
        <View accessibilityRole="adjustable" accessibilityLabel="Verse range">
          <Text lang={locale} variant="sm">
            {`Ayat ${verseRange.start}-${verseRange.end}`}
          </Text>
        </View>
      )}

      <Button label="Start practice" lang={locale} onPress={onStartPractice} />
    </View>
  );
}
