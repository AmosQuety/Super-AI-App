// A finished image task keeps its generated images (base64, megabytes) in its metadata so the
// result can be restored with the single-task query. Lists of tasks are polled every few seconds,
// so they must not carry them.

// Metadata that is missing or not a JSON object is returned unchanged rather than guessed at.
export function withoutGeneratedImages(metadata: string | null | undefined): string | null | undefined {
  if (!metadata) return metadata;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return metadata;
    if (!("images" in parsed)) return metadata;
    const { images: _images, ...rest } = parsed as Record<string, unknown>;
    return JSON.stringify(rest);
  } catch {
    return metadata;
  }
}
