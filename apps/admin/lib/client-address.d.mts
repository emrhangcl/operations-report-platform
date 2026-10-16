export function normalizeAddress(address: string | null | undefined): string | null;
export function parseTrustedProxies(value: string | undefined): Set<string>;
export function resolveClientAddress(
  socketAddress: string | null | undefined,
  forwardedFor: string | null | undefined,
  trustedProxies: Set<string>
): string | null;
