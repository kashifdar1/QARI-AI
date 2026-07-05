import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '@qari/ui';
import { LocaleProvider } from '../../i18n/LocaleContext.js';
import type { ContentClient, PassageSummary } from '../../api/contentClient.js';
import { Library } from './Library.js';

function fakeClient(passages: PassageSummary[]): ContentClient {
  return {
    listPassages: async () => passages,
    getPassageDetail: async () => {
      throw new Error('not used in this test');
    },
  } as unknown as ContentClient;
}

function renderLibrary(client: ContentClient, onSelectPassage = () => {}) {
  return render(
    <ThemeProvider>
      <LocaleProvider>
        <Library contentClient={client} onSelectPassage={onSelectPassage} />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

const SAMPLE_PASSAGES: PassageSummary[] = [
  { id: 'p1', surahNumber: 1, ayahStart: 1, ayahEnd: 7, riwayah: 'hafs_an_asim' },
  { id: 'p2', surahNumber: 114, ayahStart: 1, ayahEnd: 6, riwayah: 'hafs_an_asim' },
];

describe('Library', () => {
  it('shows loading, then lists fetched passages', async () => {
    renderLibrary(fakeClient(SAMPLE_PASSAGES));
    await waitFor(() => expect(screen.getByText('Surah 1')).toBeTruthy());
    expect(screen.getByText('Surah 114')).toBeTruthy();
    expect(screen.getByText('Ayat 1-7 · Not downloaded')).toBeTruthy();
  });

  it('calls onSelectPassage when a passage is pressed', async () => {
    const onSelect = jest.fn();
    renderLibrary(fakeClient(SAMPLE_PASSAGES), onSelect);
    await waitFor(() => expect(screen.getByText('Surah 1')).toBeTruthy());
    fireEvent.press(screen.getByText('Surah 1'));
    expect(onSelect).toHaveBeenCalledWith('p1');
  });

  it('toggles a bookmark star without navigating', async () => {
    const onSelect = jest.fn();
    renderLibrary(fakeClient(SAMPLE_PASSAGES), onSelect);
    await waitFor(() => expect(screen.getByText('Surah 1')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Bookmark surah 1'));
    expect(screen.getByLabelText('Bookmark surah 1')).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows an error state when the fetch fails', async () => {
    const failingClient = {
      listPassages: async () => {
        throw new Error('network down');
      },
      getPassageDetail: async () => {
        throw new Error('not used');
      },
    } as unknown as ContentClient;
    renderLibrary(failingClient);
    await waitFor(() => expect(screen.getByText('network down')).toBeTruthy());
  });
});
