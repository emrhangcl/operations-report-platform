import "server-only";

import type { DbClient } from "../db";
import { hashPassword } from "./password";
import { revokeUserSessions, type RequestMeta } from "./sessions";

export class AuthUserError extends Error {
  constructor(message: string, readonly code: "email_exists" | "not_found" | "invalid_email") {
    super(message);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  emailConfirmedAt: Date | null;
  encryptedPassword: string | null;
  bannedUntil: Date | null;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!emailPattern.test(normalized) || normalized.length > 320) {
    throw new AuthUserError("Gecersiz e-posta adresi.", "invalid_email");
  }
  return normalized;
}

const userColumns = `id, email, email_confirmed_at, encrypted_password, banned_until, failed_login_count, locked_until`;

function mapUser(row: {
  id: string;
  email: string;
  email_confirmed_at: Date | null;
  encrypted_password: string | null;
  banned_until: Date | null;
  failed_login_count: number;
  locked_until: Date | null;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    emailConfirmedAt: row.email_confirmed_at,
    encryptedPassword: row.encrypted_password,
    bannedUntil: row.banned_until,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until
  };
}

export async function findUserByEmail(client: DbClient, email: string, options: { forUpdate?: boolean } = {}) {
  const result = await client.query(
    `select ${userColumns} from auth.users where email = $1${options.forUpdate ? " for update" : ""}`,
    [normalizeEmail(email)]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function getUserById(client: DbClient, userId: string) {
  const result = await client.query(`select ${userColumns} from auth.users where id = $1`, [userId]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createUser(
  client: DbClient,
  input: { email: string; password: string | null; emailConfirmed: boolean; metadata?: Record<string, unknown> }
) {
  const email = normalizeEmail(input.email);
  const encryptedPassword = input.password ? await hashPassword(input.password) : null;
  try {
    const result = await client.query<{ id: string }>(
      `insert into auth.users (email, encrypted_password, email_confirmed_at, password_changed_at, raw_user_meta_data)
       values ($1, $2, case when $3 then now() end, case when $2::text is not null then now() end, $4::jsonb)
       returning id`,
      [email, encryptedPassword, input.emailConfirmed, JSON.stringify(input.metadata ?? {})]
    );
    return { id: result.rows[0]!.id, email };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new AuthUserError("Bu e-posta ile kayitli bir hesap var.", "email_exists");
    }
    throw error;
  }
}

/** Parolayi degistirir ve (istege bagli olarak biri haric) tum oturumlari sonlandirir. */
export async function setUserPassword(
  client: DbClient,
  userId: string,
  password: string,
  options: { exceptSessionId?: string; reason?: string } = {}
) {
  const encryptedPassword = await hashPassword(password);
  const result = await client.query(
    `update auth.users
        set encrypted_password = $2, password_changed_at = now(), failed_login_count = 0, locked_until = null
      where id = $1`,
    [userId, encryptedPassword]
  );
  if (result.rowCount === 0) throw new AuthUserError("Kullanici bulunamadi.", "not_found");
  await revokeUserSessions(client, userId, options.reason ?? "password_changed", options.exceptSessionId);
}

export async function confirmUserEmail(client: DbClient, userId: string) {
  await client.query("update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1", [userId]);
}

/** Kullaniciyi siler; oturumlar ve tek kullanimlik belirtecler cascade ile silinir. */
export async function deleteUser(client: DbClient, userId: string) {
  const result = await client.query("delete from auth.users where id = $1", [userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function recordSecurityEvent(
  client: DbClient,
  event: string,
  input: { userId?: string | null; email?: string | null; meta?: RequestMeta; detail?: Record<string, unknown> } = {}
) {
  await client.query(
    `insert into auth.security_events (event, user_id, email, ip_address, user_agent, detail)
     values ($1, $2, $3, $4::inet, $5, $6::jsonb)`,
    [
      event,
      input.userId ?? null,
      input.email ?? null,
      input.meta?.ip ?? null,
      input.meta?.userAgent ?? null,
      JSON.stringify(input.detail ?? {})
    ]
  );
}
