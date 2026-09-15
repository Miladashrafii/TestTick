/**
 * Wraps a value in Unicode isolate marks (FSI … PDI) so it keeps its own
 * direction when interpolated into a translated sentence. Without this, a build
 * name like `1.0.0-rc1` reorders to `rc1-1.0.0` inside Persian copy, and
 * `dir="ltr"` is not available because the value sits inside a message string.
 */
export function isolate(value: string): string {
  return `\u2068${value}\u2069`;
}
