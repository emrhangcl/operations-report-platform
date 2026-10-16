// Ilk yonetici hesaplarini olusturur.
//
//   pnpm create-admin                          -> etkilesimli: platform sahibi veya firma yoneticisi
//   pnpm create-admin --platform               -> platform sahibi (/platform paneli)
//   pnpm create-admin --organization <slug>    -> mevcut aktif firmaya yonetici
//
// Etkilesimsiz kullanim icin ADMIN_EMAIL, ADMIN_FIRST_NAME, ADMIN_LAST_NAME ve ADMIN_PASSWORD
// ortam degiskenleri verilebilir. Parola komut satiri argumani olarak alinmaz; boylece kabuk
// gecmisine ve surec listesine dusmez. Veritabanina otomatik demo hesap eklenmez.

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { AuthUserError, createUser } from "../apps/admin/lib/server/auth/users";
import { closePool, withServiceContext } from "../apps/admin/lib/server/db";

const MIN_PASSWORD_LENGTH = 10;

function argument(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "";
}

async function main() {
  const rl = createInterface({ input, output });
  const ask = async (question: string, fallback?: string) => (fallback ?? await rl.question(question)).trim();

  try {
    let mode: "platform" | "organization";
    let organizationSlug = argument("--organization");
    if (process.argv.includes("--platform")) {
      mode = "platform";
    } else if (organizationSlug !== undefined) {
      mode = "organization";
    } else {
      const answer = await ask("Hesap turu - [p]latform sahibi / [f]irma yoneticisi: ");
      mode = answer.toLowerCase().startsWith("f") ? "organization" : "platform";
    }

    if (mode === "organization" && !organizationSlug) {
      organizationSlug = await ask("Firma kodu (slug): ", process.env.ORGANIZATION_SLUG);
    }

    const firstName = await ask("Ad: ", process.env.ADMIN_FIRST_NAME);
    const lastName = await ask("Soyad: ", process.env.ADMIN_LAST_NAME);
    const email = await ask("E-posta: ", process.env.ADMIN_EMAIL);
    const password = process.env.ADMIN_PASSWORD ?? await rl.question(`Parola (en az ${MIN_PASSWORD_LENGTH} karakter): `);

    if (!firstName || !lastName || !email || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Ad, soyad, e-posta ve en az ${MIN_PASSWORD_LENGTH} karakter parola zorunludur.`);
    }

    // Hesap ve yetki kaydi tek transaction icinde olusur; hata olursa hicbiri kalici olmaz.
    const summary = await withServiceContext(async (client) => {
      if (mode === "platform") {
        const user = await createUser(client, {
          email,
          password,
          emailConfirmed: true,
          metadata: { first_name: firstName, last_name: lastName }
        });
        await client.query("insert into private.platform_admins (user_id) values ($1)", [user.id]);
        return `Platform sahibi hesabi olusturuldu: ${user.email} (giris sonrasi /platform)`;
      }

      const organization = await client.query<{ id: string; name: string; status: string }>(
        "select id, name, status from public.organizations where slug = $1",
        [organizationSlug]
      );
      const target = organization.rows[0];
      if (!target || target.status !== "active") {
        throw new Error("Aktif firma bulunamadi. Once firmayi olusturup etkinlestirin.");
      }

      const user = await createUser(client, {
        email,
        password,
        emailConfirmed: true,
        metadata: { first_name: firstName, last_name: lastName }
      });
      await client.query(
        `insert into public.profiles (id, organization_id, first_name, last_name, email, role, is_active)
         values ($1, $2, $3, $4, $5, 'ADMIN', true)`,
        [user.id, target.id, firstName, lastName, user.email]
      );
      await client.query(
        `insert into public.organization_members (organization_id, profile_id, role, is_active)
         values ($1, $2, 'ADMIN', true)`,
        [target.id, user.id]
      );
      return `Firma yoneticisi olusturuldu: ${user.email} (${target.name})`;
    });

    console.log(summary);
  } catch (error) {
    const message = error instanceof AuthUserError || error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error(`Hesap olusturulamadi: ${message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
    await closePool();
  }
}

void main();
