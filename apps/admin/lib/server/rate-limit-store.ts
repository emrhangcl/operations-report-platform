import "server-only";

import { withServiceContext } from "./db";

// PostgreSQL tabanli kalici hiz siniri sayaclari (bkz. db/migrations/0004_persistent_rate_limits.sql).

export interface RateLimitDecision {
  allowed: boolean;
  hits: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
  return withServiceContext(async (client) => {
    const result = await client.query<{ is_allowed: boolean; current_hits: number; retry_after_seconds: number }>(
      "select * from private.consume_rate_limit($1, $2, $3)",
      [key.slice(0, 300), limit, windowSeconds]
    );
    const row = result.rows[0]!;
    return { allowed: row.is_allowed, hits: row.current_hits, retryAfterSeconds: row.retry_after_seconds };
  });
}

export async function peekRateLimit(key: string, windowSeconds: number): Promise<number> {
  return withServiceContext(async (client) => {
    const result = await client.query<{ hits: number }>(
      "select private.peek_rate_limit($1, $2) as hits",
      [key.slice(0, 300), windowSeconds]
    );
    return result.rows[0]?.hits ?? 0;
  });
}

export async function resetRateLimit(key: string): Promise<void> {
  await withServiceContext((client) => client.query("select private.reset_rate_limit($1)", [key.slice(0, 300)]));
}
