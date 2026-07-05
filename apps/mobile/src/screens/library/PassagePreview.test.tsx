import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@qari/ui';
import { LocaleProvider } from '../../i18n/LocaleContext.js';
import type { ContentClient, PassageDetail } from '../../api/contentClient.js';
import { PassagePreview } from './PassagePreview.js';

// __dirname (not import.meta.url) — React Native's Babel preset targets
// CommonJS, which doesn't support import.meta under Jest.
const SOURCE_PATH = join(__dirname, '../../../../../content-import/sources/tanzil-uthmani-v1.1.txt');

function loadAyahText(sura: number, aya: number): string {
  const lines = readFileSync(SOURCE_PATH, 'utf-8').split('\n');
  const line = lines.find((l) => l.startsWith(`${sura}|${aya}|`));
  if (!line) throw new Error(`Ayah ${sura}:${aya} not found`);
  return line.split('|').slice(2).join('|').trim();
}

function fatihaDetail(): PassageDetail {
  return {
    id: 'p1',
    surahNumber: 1,
    ayahStart: 1,
    ayahEnd: 1,
    riwayah: 'hafs_an_asim',
    referenceAudioUrl: 'https://example.com/placeholder-audio/PLACEHOLDER_AUDIO_surah-001.wav',
    reciterId: 'placeholder-reciter',
    ayahs: [
      {
        ayahNumber: 1,
        words: loadAyahText(1, 1)
          .split(/\s+/u)
          .map((displayText, wordIndex) => ({ wordIndex, displayText })),
      },
    ],
    translation: { available: false, reason: 'no_cleared_translation_license' },
  };
}

function fakeClient(detail: PassageDetail): ContentClient {
  return {
    listPassages: async () => [],
    getPassageDetail: async () => detail,
  } as unknown as ContentClient;
}

function renderPreview(client: ContentClient, onStartPractice: () => void = () => {}) {
  return render(
    <ThemeProvider>
      <LocaleProvider>
        <PassagePreview passageId="p1" contentClient={client} onStartPractice={onStartPractice} />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

describe('PassagePreview', () => {
  it('renders the riwayah badge and the real ayah text', async () => {
    renderPreview(fakeClient(fatihaDetail()));
    await waitFor(() => expect(screen.getByText("Hafs 'an 'Asim")).toBeTruthy());
    expect(screen.getByText(loadAyahText(1, 1))).toBeTruthy();
    expect(screen.getByText('(1)')).toBeTruthy();
  });

  it('shows "Translation unavailable" when the translation is stubbed as unavailable', async () => {
    renderPreview(fakeClient(fatihaDetail()));
    await waitFor(() => expect(screen.getByText('Translation unavailable')).toBeTruthy());
  });

  it('changes the displayed speed when a speed button is pressed', async () => {
    renderPreview(fakeClient(fatihaDetail()));
    await waitFor(() => expect(screen.getByText('Speed: 1x')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: '0.5x' }));
    expect(screen.getByText('Speed: 0.5x')).toBeTruthy();
  });

  it('shows a verse-range indicator seeded from the passage ayah bounds', async () => {
    renderPreview(fakeClient(fatihaDetail()));
    await waitFor(() => expect(screen.getByText('Ayat 1-1')).toBeTruthy());
  });

  it('calls onStartPractice when "Start practice" is pressed', async () => {
    const onStartPractice = jest.fn();
    renderPreview(fakeClient(fatihaDetail()), onStartPractice);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start practice' })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Start practice' }));
    expect(onStartPractice).toHaveBeenCalledTimes(1);
  });
});
