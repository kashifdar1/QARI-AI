// See __mocks__/expo-audio.ts — same reasoning, this only prevents native
// module imports from crashing the test suite for files that transitively
// reference expoAudioRecorder.ts.
export async function deleteAsync(): Promise<void> {}
