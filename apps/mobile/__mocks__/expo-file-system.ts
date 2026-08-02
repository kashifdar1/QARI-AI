// See __mocks__/expo-audio.ts — same reasoning, this only prevents native
// module imports from crashing the test suite for files that transitively
// reference expoAudioRecorder.ts.
export async function deleteAsync(): Promise<void> {}

// jest.fn() (not a plain function) so AppNavigator.test.tsx's upload-flow
// tests can override the result per test via
// (getInfoAsync as jest.Mock).mockResolvedValueOnce(...) when needed;
// defaults to "the file is there" for tests that don't care.
export const getInfoAsync = jest.fn(async () => ({ exists: true, size: 12345 }));
