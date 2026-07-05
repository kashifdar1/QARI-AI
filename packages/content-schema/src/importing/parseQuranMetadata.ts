import { surahMetadataSchema, type SurahMetadata } from '../surah.js';

/**
 * Parses Tanzil's `quran-data.xml` `<sura .../>` elements. Deliberately a
 * small targeted attribute-regex rather than pulling in a full XML parser
 * dependency — the file's `<sura>` elements are simple, self-closing,
 * attribute-only elements with a fixed, documented attribute set (see
 * content-import/sources/PROVENANCE.md), not general XML.
 */

const SURA_ELEMENT_PATTERN = /<sura\s+([^/]+?)\/>/gu;
const ATTRIBUTE_PATTERN = /(\w+)="([^"]*)"/gu;

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of attrString.matchAll(ATTRIBUTE_PATTERN)) {
    attrs[match[1]!] = match[2]!;
  }
  return attrs;
}

export function parseQuranMetadata(xml: string): SurahMetadata[] {
  const results: SurahMetadata[] = [];
  for (const elementMatch of xml.matchAll(SURA_ELEMENT_PATTERN)) {
    const attrs = parseAttributes(elementMatch[1]!);
    const candidate = {
      index: Number(attrs.index),
      ayahCount: Number(attrs.ayas),
      nameArabic: attrs.name ?? '',
      nameTransliterated: attrs.tname ?? '',
      nameEnglish: attrs.ename ?? '',
      revelationType: attrs.type as 'Meccan' | 'Medinan',
      revelationOrder: Number(attrs.order),
      rukuCount: Number(attrs.rukus),
    };
    results.push(surahMetadataSchema.parse(candidate));
  }
  return results.sort((a, b) => a.index - b.index);
}
