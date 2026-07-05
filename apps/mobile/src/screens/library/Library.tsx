import { useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Card, ErrorState, LoadingState, Text } from '@qari/ui';
import type { ContentClient, PassageSummary } from '../../api/contentClient.js';
import { useLocale } from '../../i18n/LocaleContext.js';

export type LibraryProps = {
  contentClient: ContentClient;
  onSelectPassage: (passageId: string) => void;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; passages: PassageSummary[] };

/**
 * Browse by Surah (Milestone B task 4). Juz-based browsing and offline
 * download status are shown as static "not downloaded" placeholders —
 * offline packs are Milestone D scope (CLAUDE.md backlog); this screen
 * only needs to indicate state, not implement downloading.
 */
export function Library({ contentClient, onSelectPassage }: LibraryProps): JSX.Element {
  const { locale, t } = useLocale();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    contentClient
      .listPassages()
      .then((passages) => {
        if (!cancelled) setState({ status: 'ready', passages });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [contentClient]);

  if (state.status === 'loading') {
    return <LoadingState lang={locale} label={t('tabs.library.title')} />;
  }
  if (state.status === 'error') {
    return <ErrorState lang={locale} title={t('common.retry')} description={state.message} />;
  }

  return (
    <FlatList
      data={state.passages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <Pressable onPress={() => onSelectPassage(item.id)} accessibilityRole="button">
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text lang={locale} variant="md">
                {`Surah ${item.surahNumber}`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Bookmark surah ${item.surahNumber}`}
                onPress={() =>
                  setBookmarked((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
              >
                <Text lang={locale} variant="sm">
                  {bookmarked.has(item.id) ? '★' : '☆'}
                </Text>
              </Pressable>
            </View>
            <Text lang={locale} variant="xs" muted>
              {`Ayat ${item.ayahStart}-${item.ayahEnd} · Not downloaded`}
            </Text>
          </Card>
        </Pressable>
      )}
    />
  );
}
