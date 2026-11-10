/** Live-probed supported version (2026-11-03 returned no deprecation warning). */
export const JOBBER_SUPPORTED_API_VERSION = "2026-11-03";

export function jobberGraphqlVersion(configured?: string): string {
  const v = configured?.trim();
  if (v && v >= JOBBER_SUPPORTED_API_VERSION) return v;
  return JOBBER_SUPPORTED_API_VERSION;
}
