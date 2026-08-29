import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadProjectEnv() {
  const envPath = resolve(process.cwd(), ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, "utf8");

  for (const rawLine of envFile.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const entry = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) {
      continue;
    }

    let value = entry.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadProjectEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gereklidir."
    );
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  let createdUserId: string | null = null;

  try {
    const organizationSlug = (
      process.env.ORGANIZATION_SLUG ?? await rl.question("Organizasyon slug: ")
    ).trim();
    const firstName = (await rl.question("Admin adı: ")).trim();
    const lastName = (await rl.question("Admin soyadı: ")).trim();
    const email = (await rl.question("Admin e-posta: ")).trim();
    const password = await rl.question("Admin şifre: ");

    if (!organizationSlug || !firstName || !lastName || !email || password.length < 8) {
      throw new Error("Organizasyon, ad, soyad, e-posta ve en az 8 karakter şifre zorunludur.");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("id,name,status")
      .eq("slug", organizationSlug)
      .maybeSingle();

    if (organizationError) throw organizationError;
    if (!organization || organization.status !== "active") {
      throw new Error("Aktif organizasyon bulunamadı. Önce organizasyonu oluşturun.");
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });

    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error("Auth kullanıcısı oluşturulamadı.");
    createdUserId = userId;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      organization_id: organization.id,
      first_name: firstName,
      last_name: lastName,
      email,
      role: "ADMIN",
      is_active: true
    });

    if (profileError) throw profileError;

    const { error: membershipError } = await supabase.from("organization_members").upsert({
      organization_id: organization.id,
      profile_id: userId,
      role: "ADMIN",
      is_active: true
    });

    if (membershipError) throw membershipError;

    createdUserId = null;
    console.log(`Admin hesabı oluşturuldu: ${email} (${organization.name})`);
  } catch (error) {
    if (createdUserId) {
      const cleanupClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      await cleanupClient.auth.admin.deleteUser(createdUserId);
    }

    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    console.error(`Admin oluşturulamadı: ${message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

void main();
