/**
 * True when the server refused a request because the user's tier doesn't cover
 * it (see requirePro / requireAiQuota in src/lib/entitlements.ts).
 *
 * Call this BEFORE any generic `if (data.error) throw` — otherwise a paywall
 * response gets surfaced as a raw error string or, worse, swallowed by a catch
 * block into a misleading "something went wrong".
 */
export function isUpgradeRequired(res: Response, data: unknown): boolean {
  if (res.status === 402) return true
  return (data as { code?: string } | null)?.code === 'upgrade_required'
}
