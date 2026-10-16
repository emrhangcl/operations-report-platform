import "server-only";

import { getServerConfig } from "../config";
import { withServiceContext, type DbClient } from "../db";
import { sendMail } from "../mailer";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { createSession, revokeSessionByToken, type RequestMeta, type SessionClientType, type SessionScope } from "./sessions";
import { generateToken, hashToken } from "./tokens";
import { confirmUserEmail, findUserByEmail, normalizeEmail, recordSecurityEvent, setUserPassword } from "./users";

export type LoginFailureReason =
  | "invalid_credentials"
  | "locked"
  | "email_not_confirmed"
  | "no_active_profile"
  | "no_active_membership";

export type LoginResult =
  | { ok: true; userId: string; scope: SessionScope; redirectTo: string; token: string; expiresAt: Date }
  | { ok: false; reason: LoginFailureReason };

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

interface AccessContextRow {
  organization_id: string | null;
  profile_is_active: boolean | null;
  member_role: string | null;
  membership_is_active: boolean | null;
  organization_status: string | null;
  access_mode: string | null;
}

/** Giris sonrasi kullanicinin oturum kapsamini ve yonlendirilecegi alani belirler. */
async function resolveDestination(client: DbClient, userId: string):
  Promise<{ scope: SessionScope; redirectTo: string } | { failure: LoginFailureReason }> {
  const platform = await client.query<{ ok: boolean }>("select public.is_platform_admin_for_user($1) as ok", [userId]);
  if (platform.rows[0]?.ok) return { scope: "admin", redirectTo: "/platform" };

  const result = await client.query<AccessContextRow>("select * from public.get_user_access_context($1)", [userId]);
  const context = result.rows[0];
  if (!context?.organization_id || context.profile_is_active !== true) return { failure: "no_active_profile" };
  if (!context.membership_is_active || !context.member_role) return { failure: "no_active_membership" };
  if (context.member_role === "PERSONNEL") return { scope: "personnel", redirectTo: "/personel" };
  if (context.organization_status !== "active" || context.access_mode === "blocked") {
    return { scope: "admin", redirectTo: "/subscription" };
  }
  return { scope: "admin", redirectTo: "/app" };
}

export async function login(input: {
  email: string;
  password: string;
  clientType: SessionClientType;
  meta: RequestMeta;
}): Promise<LoginResult> {
  const config = getServerConfig();
  let email: string;
  try {
    email = normalizeEmail(input.email);
  } catch {
    await verifyPassword(input.password, null);
    return { ok: false, reason: "invalid_credentials" };
  }

  return withServiceContext(async (client): Promise<LoginResult> => {
    const user = await findUserByEmail(client, email, { forUpdate: true });
    const now = Date.now();

    if (user?.lockedUntil && user.lockedUntil.getTime() > now) {
      await verifyPassword(input.password, null);
      await recordSecurityEvent(client, "login_blocked_locked", { userId: user.id, email, meta: input.meta });
      return { ok: false, reason: "locked" };
    }

    const passwordValid = await verifyPassword(input.password, user?.encryptedPassword ?? null);
    const banned = Boolean(user?.bannedUntil && user.bannedUntil.getTime() > now);

    if (!user || !passwordValid || banned) {
      if (user && !banned) {
        const failed = user.failedLoginCount + 1;
        const lock = failed >= config.login.maxFailedAttempts;
        await client.query(
          "update auth.users set failed_login_count = $2, locked_until = $3 where id = $1",
          [user.id, lock ? 0 : failed, lock ? new Date(now + config.login.lockMinutes * 60_000) : null]
        );
        if (lock) await recordSecurityEvent(client, "account_locked", { userId: user.id, email, meta: input.meta });
      }
      await recordSecurityEvent(client, "login_failed", {
        userId: user?.id ?? null,
        email,
        meta: input.meta,
        detail: { reason: !user ? "unknown_email" : banned ? "banned" : "bad_password" }
      });
      return { ok: false, reason: "invalid_credentials" };
    }

    if (config.requireEmailVerification && !user.emailConfirmedAt) {
      await recordSecurityEvent(client, "login_denied", { userId: user.id, email, meta: input.meta, detail: { reason: "email_not_confirmed" } });
      return { ok: false, reason: "email_not_confirmed" };
    }

    const destination = await resolveDestination(client, user.id);
    if ("failure" in destination) {
      await recordSecurityEvent(client, "login_denied", { userId: user.id, email, meta: input.meta, detail: { reason: destination.failure } });
      return { ok: false, reason: destination.failure };
    }

    const rehashed = user.encryptedPassword && needsRehash(user.encryptedPassword) ? await hashPassword(input.password) : null;
    await client.query(
      `update auth.users
          set failed_login_count = 0, locked_until = null, last_sign_in_at = now(),
              encrypted_password = coalesce($2, encrypted_password)
        where id = $1`,
      [user.id, rehashed]
    );

    const session = await createSession(client, {
      userId: user.id,
      scope: destination.scope,
      clientType: input.clientType,
      meta: input.meta
    });
    await recordSecurityEvent(client, "login_succeeded", {
      userId: user.id,
      email,
      meta: input.meta,
      detail: { scope: destination.scope, client: input.clientType }
    });

    return {
      ok: true,
      userId: user.id,
      scope: destination.scope,
      redirectTo: destination.redirectTo,
      token: session.token,
      expiresAt: session.expiresAt
    };
  });
}

export async function logout(token: string, meta: RequestMeta, userId?: string) {
  await revokeSessionByToken(token, "logout");
  if (userId) {
    await withServiceContext((client) => recordSecurityEvent(client, "logout", { userId, meta }));
  }
}

async function issueOneTimeToken(
  client: DbClient,
  userId: string,
  purpose: "email_verification" | "password_reset",
  ttlMs: number,
  meta?: RequestMeta
) {
  await client.query(
    "update auth.one_time_tokens set consumed_at = now() where user_id = $1 and purpose = $2 and consumed_at is null",
    [userId, purpose]
  );
  const token = generateToken();
  await client.query(
    `insert into auth.one_time_tokens (user_id, purpose, token_hash, expires_at, requested_ip)
     values ($1, $2, $3, $4, $5::inet)`,
    [userId, purpose, hashToken(token), new Date(Date.now() + ttlMs), meta?.ip ?? null]
  );
  return token;
}

async function consumeOneTimeToken(client: DbClient, token: string, purpose: "email_verification" | "password_reset") {
  if (!tokenPattern.test(token)) return null;
  const result = await client.query<{ user_id: string }>(
    `update auth.one_time_tokens
        set consumed_at = now()
      where token_hash = $1 and purpose = $2 and consumed_at is null and expires_at > now()
      returning user_id`,
    [hashToken(token), purpose]
  );
  return result.rows[0]?.user_id ?? null;
}

function appLink(path: string, token: string) {
  const url = new URL(path, getServerConfig().appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

/** Yonetici tarafindan baslatilan veya e-posta ile istenen parola yenileme baglantisi. */
export async function createPasswordResetLink(client: DbClient, userId: string, meta?: RequestMeta) {
  const token = await issueOneTimeToken(client, userId, "password_reset", PASSWORD_RESET_TTL_MS, meta);
  return appLink("/reset-password", token);
}

/** Hesap var olsun ya da olmasin ayni yaniti verir; boylece kayitli e-postalar sizdirilmaz. */
export async function requestPasswordReset(email: string, meta: RequestMeta) {
  let normalized: string;
  try {
    normalized = normalizeEmail(email);
  } catch {
    return;
  }

  await withServiceContext(async (client) => {
    const user = await findUserByEmail(client, normalized);
    await recordSecurityEvent(client, "password_reset_requested", { userId: user?.id ?? null, email: normalized, meta });
    if (!user) return;
    const link = await createPasswordResetLink(client, user.id, meta);
    await sendMail({
      to: user.email,
      subject: "Parola yenileme baglantiniz",
      text: [
        "Operasyon Portali hesabiniz icin parola yenileme istendi.",
        "",
        `Yeni parola belirlemek icin baglanti (60 dakika gecerli): ${link}`,
        "",
        "Bu istegi siz yapmadiysaniz bu e-postayi dikkate almayin."
      ].join("\n")
    });
  });
}

export async function resetPasswordWithToken(token: string, password: string, meta: RequestMeta) {
  return withServiceContext(async (client) => {
    const userId = await consumeOneTimeToken(client, token, "password_reset");
    if (!userId) return false;
    await setUserPassword(client, userId, password, { reason: "password_reset" });
    // Baglantiyi acabilen kullanici e-posta adresinin sahibidir.
    await confirmUserEmail(client, userId);
    await recordSecurityEvent(client, "password_reset_completed", { userId, meta });
    return true;
  });
}

export async function sendEmailVerification(client: DbClient, userId: string, email: string) {
  const token = await issueOneTimeToken(client, userId, "email_verification", EMAIL_VERIFICATION_TTL_MS);
  await sendMail({
    to: email,
    subject: "E-posta adresinizi dogrulayin",
    text: [
      "Operasyon Portali kaydinizi tamamlamak icin e-posta adresinizi dogrulayin.",
      "",
      `Dogrulama baglantisi (48 saat gecerli): ${appLink("/verify-email", token)}`
    ].join("\n")
  });
}

export async function verifyEmailWithToken(token: string, meta: RequestMeta) {
  return withServiceContext(async (client) => {
    const userId = await consumeOneTimeToken(client, token, "email_verification");
    if (!userId) return false;
    await confirmUserEmail(client, userId);
    await recordSecurityEvent(client, "email_verified", { userId, meta });
    return true;
  });
}
