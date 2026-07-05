/**
 * Parses Tanzil's `txt-2` export format (`sura|aya|text` per line, a
 * trailing `#`-prefixed copyright block) into structured ayah records. This
 * is the ONLY function permitted to turn the raw Tanzil file into
 * application data — nothing downstream re-parses the raw text.
 */

export type ParsedAyah = {
  surahNumber: number;
  ayahNumber: number;
  text: string;
};

export type ParseResult = {
  ayat: ParsedAyah[];
  /** Non-fatal lines that were neither valid data nor a recognized comment/blank line. */
  unparseableLines: Array<{ lineNumber: number; content: string }>;
};

export function parseTanzilText(raw: string): ParseResult {
  const lines = raw.split('\n');
  const ayat: ParsedAyah[] = [];
  const unparseableLines: ParseResult['unparseableLines'] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      return;
    }
    const match = /^(\d+)\|(\d+)\|(.+)$/u.exec(trimmed);
    if (!match) {
      unparseableLines.push({ lineNumber: index + 1, content: line });
      return;
    }
    const [, surahStr, ayahStr, text] = match;
    ayat.push({
      surahNumber: Number(surahStr),
      ayahNumber: Number(ayahStr),
      text: text!.trim(),
    });
  });

  return { ayat, unparseableLines };
}
