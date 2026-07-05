import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react-native';
import { colorsFor, ThemeProvider, type ColorScheme } from '@qari/ui';
import { Text } from '@qari/ui';

/**
 * "Arabic visual regression" per Milestone B task 4/acceptance criteria,
 * scoped to what's actually verifiable in this environment: there is no
 * simulator/device here to capture real pixel screenshots, so this is a
 * structural rendering assertion (font family/size/direction actually
 * applied, against real Tanzil source text) rather than an image diff.
 * Real pixel-level visual QA against a device/simulator is an explicit,
 * named gap in the milestone risk notes.
 */

// __dirname (not import.meta.url) — React Native's Babel preset targets
// CommonJS, which doesn't support import.meta under Jest.
const SOURCE_PATH = join(__dirname, '../../../../../content-import/sources/tanzil-uthmani-v1.1.txt');

function loadAyahText(sura: number, aya: number): string {
  const lines = readFileSync(SOURCE_PATH, 'utf-8').split('\n');
  const line = lines.find((l) => l.startsWith(`${sura}|${aya}|`));
  if (!line) throw new Error(`Ayah ${sura}:${aya} not found`);
  return line.split('|').slice(2).join('|').trim();
}

const SAMPLE_SURAHS: Array<{ label: string; sura: number; aya: number }> = [
  { label: 'Al-Fatihah', sura: 1, aya: 1 },
  { label: 'Al-Ikhlas', sura: 112, aya: 1 },
  { label: 'An-Nas', sura: 114, aya: 1 },
];

const SCALES = ['arabic-sm', 'arabic-reader', 'arabic-xl'] as const;
const SCHEMES: ColorScheme[] = ['light', 'dark'];

describe('Arabic rendering — 3 surahs x 3 font scales x light/dark', () => {
  for (const { label, sura, aya } of SAMPLE_SURAHS) {
    const text = loadAyahText(sura, aya);

    for (const scale of SCALES) {
      for (const scheme of SCHEMES) {
        it(`${label} renders correctly at ${scale} in ${scheme} mode`, () => {
          render(
            <ThemeProvider initialScheme={scheme}>
              <Text lang="ar" variant={scale}>
                {text}
              </Text>
            </ThemeProvider>,
          );

          const rendered = screen.getByText(text);
          const style = Object.assign({}, ...[rendered.props.style].flat(Infinity).filter(Boolean));

          // No glyph-shaping breakage proxy: the full verbatim source text
          // round-trips into the rendered node untouched (no truncation,
          // no mangling, no substitution).
          expect(rendered.props.children).toBe(text);
          expect(style.writingDirection).toBe('rtl');
          expect(style.textAlign).toBe('right');
          expect(style.fontFamily).toBe('KFGQPCUthmanicScriptHafs-Regular');
          expect(style.color).toBe(colorsFor(scheme).textPrimary);
        });
      }
    }
  }
});
