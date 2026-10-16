import "server-only";

import { getServerConfig } from "../config";
import { withServiceContext, type DbClient } from "../db";
import { generateToken, hashToken } from "./tokens";

export type SessionScope = "admin" | "personnel";
export type SessionClientType = "web" | "mobile";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface ActiveSession {
  sessionId: string;
  userId: string;
  email: string;
  emailConfirmedAt: string | null;
  scope: SessionScope;
  client: SessionClientType;
  expiresAt: Date;
}

const TOUCH_INTERVAL_MS = 60_000;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function isSessionScope(value: unknown): value is SessionScope {
  return value === "admin" || value === "personnel";
}

function lifetimeHours(scope: SessionScope) {
  const { session } = getServerConfig();
  return scope === "admin"
    ? { ttl: session.adminTtlHours, idle: session.adminIdleHours }
    : { ttl: session.personnelTtlHours, idle: session.personnelIdleHours };
}

export async function createSession(
  client: DbClient,
  input: { userId: string; scope: SessionScope; clientType: SessionClientType; meta: RequestMeta }
) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + lifetimeHours(input.scope).ttl * 3_600_000);
  const result = await client.query<{ id: string }>(
    `insert into auth.sessions (user_id, token_hash, scope, client, expires_at, ip_address, user_agent)
     values ($1, $2, $3, $4, $5, $6::inet, $7)
     returning id`,
    [input.userId, hashToken(token), input.scope, input.clientType, expiresAt, input.meta.ip, input.meta.userAgent?.slice(0, 400) ?? null]
  );
  return { token, sessionId: result.rows[0]!.id, expiresAt };
}

export async function resolveSession(token: string): Promise<ActiveSession | null> {
  if (!tokenPattern.test(token)) return null;

  return withServiceContext(async (client) => {
    const result = await client.query<{
      id: string;
      user_id: string;
      scope: SessionScope;
      client: SessionClientType;
      expires_at: Date;
      last_used_at: Date;
      email: string;
      email_confirmed_at: Date | null;
      banned_until: Date | null;
    }>(
      `select s.id, s.user_id, s.scope, s.client, s.expires_at, s.last_used_at,
              u.email, u.email_confirmed_at, u.banned_until
         from auth.sessions s
         join auth.users u on u.id = s.user_id
        where s.token_hash = $1 and s.revoked_at is null`,
      [hashToken(token)]
    );
    const row = result.rows[0];
    if (!row) return null;

    const now = Date.now();
    const idleLimit = row.last_used_at.getTime() + lifetimeHours(row.scope).idle * 3_600_000;
    const revokeReason = row.expires_at.getTime() <= now
      ? "expired"
      : idleLimit <= now
        ? "idle"
        : row.banned_until && row.banned_until.getTime() > now
          ? "banned"
          : null;

    if (revokeReason) {
      await client.query(
        "update auth.sessions set revoked_at = now(), revoked_reason = $2 where id = $1 and revoked_at is null",
        [row.id, revokeReason]
      );
      return null;
    }

    if (now - row.last_used_at.getTime() > TOUCH_INTERVAL_MS) {
      await client.query("update auth.sessions set last_used_at = now() where id = $1", [row.id]);
    }

    return {
      sessionId: row.id,
      userId: row.user_id,
      email: row.email,
      emailConfirmedAt: row.email_confirmed_at?.toISOString() ?? null,
      scope: row.scope,
      client: row.client,
      expiresAt: row.expires_at
    };
  });
}

export async function revokeSessionByToken(token: string, reason: string) {
  if (!tokenPattern.test(token)) return;
  await withServiceContext((client) => client.query(
    "update auth.sessions set revoked_at = now(), revoked_reason = $2 where token_hash = $1 and revoked_at is null",
    [hashToken(token), reason]
  ));
}

export async function revokeUserSessions(client: DbClient, userId: string, reason: string, exceptSessionId?: string) {
  await client.query(
    `update auth.sessions
        set revoked_at = now(), revoked_reason = $2
      where user_id = $1 and revoked_at is null and ($3::uuid is null or id <> $3::uuid)`,
    [userId, reason, exceptSessionId ?? null]
  );
}
