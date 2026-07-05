# Font binaries — not included (blocked on human licensing step)

This directory intentionally contains no font files yet. Per CLAUDE.md
Principle 7 (no fake/placeholder binaries), no `.ttf`/`.otf` file is
committed here until the real, licensed font is obtained.

Tracked as a stub in `docs/STUBS.md`. Required files, by the family names
defined in `packages/ui/src/theme/typography.ts` (`fontFamilies`):

| File (expected) | Purpose | Status |
|---|---|---|
| `KFGQPCUthmanicScriptHafs-Regular.ttf` | Quran text rendering (CLAUDE.md §3) | **Blocked** — human must obtain from the King Fahd Complex distribution and include its license file alongside it |
| `NotoNastaliqUrdu-Regular.ttf` | Urdu UI/body text | Available under OFL from Google Fonts — safe to add once a maintainer fetches and verifies the license file |
| `NotoNaskhArabicUI-Regular.ttf` | Android Nastaliq-shaping fallback (see typography.ts comment) | Same as above |
| `Inter-Regular.ttf` / `Inter-Medium.ttf` / `Inter-SemiBold.ttf` | Latin UI text | OFL, available from Google Fonts |

Unblocking condition: a maintainer downloads the above files from their
verified sources, adds each font's license file next to it in this
directory, and wires them into `apps/mobile` via `expo-font` /
`app.json` `expo.fonts`. Until then, `apps/mobile` must not assume these
fonts are loaded — components should fail visibly (fallback to system font)
rather than crash if a family name from `fontFamilies` isn't registered.
