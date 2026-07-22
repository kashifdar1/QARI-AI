/**
 * Reads a local recording (file://...) into a Blob and PUTs it to a
 * pre-signed object-storage URL. `fetch(localUri).blob()` is the standard
 * React Native pattern for turning a local file URI into upload-able
 * bytes without adding a native file-reading dependency.
 */
export async function uploadLocalFile(localUri: string, signedUrl: string, contentType: string): Promise<void> {
  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();
  const uploadResponse = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: blob,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload recording (${uploadResponse.status})`);
  }
}
