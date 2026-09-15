/**
 * Normalizes Supabase URL to ensure no trailing slashes or accidental path suffixes like /rest/v1
 */
export function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1\/?$/, '');
  return url;
}
