# Reciter audio licenses

No reciter audio is cleared for this repository yet. CLAUDE.md's own
human-owner task list says explicitly: *"Verify and record the license for
the chosen MVP reciter's audio"* — that verification is a human step, not
something to be resolved by guessing at a source and its license terms.

Until a reciter is cleared, `ReciterAudio` rows reference generated silent
placeholder WAV files (`PLACEHOLDER_AUDIO`, see `docs/STUBS.md` and
`services/api/src/content-import/placeholderAudio.ts`), never real
recitation audio under an unverified license.

## When a reciter is cleared

Add one file here per reciter, named `<reciter-id>.md`, containing at
minimum:

- Reciter name and the exact source (site/organization) the audio came from
- License name and a link to its full text
- Whether the license permits the specific use here (bundling in a
  commercial mobile app, redistributing via CDN/object storage, allowing
  playback-speed alteration)
- Date verified and by whom

Then flip the corresponding `reciter_audio.is_placeholder` row to `false`
and point `object_key` at the real audio object.
