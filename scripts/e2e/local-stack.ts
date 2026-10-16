// Uctan uca yerel sistem testi: calisan uygulamaya (pnpm dev:admin) HTTP uzerinden, tarayicinin
// kullandigi ayni uc noktalar, cerezler ve sorgu olusturucu ile baglanir. Is akislarini ve
// guvenlik katmanlarini (oturum, CSRF, izin listesi, RLS, dosya dogrulama, imzali baglanti) dener.
//
//   pnpm test:e2e
//
// Gerekli: APP_URL ve .env icindeki E2E_* test hesaplari (platform sahibi, firma yoneticisi).
// Her calistirmada yeni ve gecici bir "B kiraci" firmasi olusturulur.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createQueryClient, type QueryResult, type QuerySpec } from "@operations/data-client";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(repoRoot, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const baseUrl = new URL(process.env.APP_URL ?? "http://localhost:3000").origin;
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const VALID_SIGNATURE = {
  version: 1,
  signer_name: "Ayse Demir",
  signer_title: "Teknik Mudur",
  consent: true,
  strokes: [[[0, 0], [30, 0], [60, 10]]]
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} .env dosyasinda tanimli degil.`);
  return value;
}

type Scope = "admin" | "personnel";

class WebSession {
  private readonly cookies = new Map<string, string>();
  readonly db;

  constructor(readonly scope: Scope, private readonly origin = baseUrl) {
    this.db = createQueryClient(async (spec: QuerySpec) => {
      const response = await this.fetch("/api/data", { method: "POST", json: spec });
      return await response.json() as QueryResult<unknown>;
    });
  }

  cookieHeader() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  cookieValue(name: string) {
    return this.cookies.get(name);
  }

  async fetch(path: string, init: { method?: string; json?: unknown; body?: BodyInit; headers?: Record<string, string>; scopeHeader?: boolean } = {}) {
    const headers: Record<string, string> = { Origin: this.origin, ...init.headers };
    if (init.scopeHeader !== false) headers["X-Auth-Scope"] = this.scope;
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    let body = init.body;
    if (init.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.json);
    }
    const response = await fetch(new URL(path, baseUrl), { method: init.method ?? "GET", headers, body, redirect: "manual" });
    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";");
      const separator = pair!.indexOf("=");
      const name = pair!.slice(0, separator).trim();
      const value = pair!.slice(separator + 1).trim();
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return response;
  }

  async login(email: string, password: string) {
    const response = await this.fetch("/api/auth/login", { method: "POST", json: { email, password }, scopeHeader: false });
    const body = await response.json() as { scope?: Scope; redirectTo?: string; message?: string };
    return { response, body };
  }
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

const results: CheckResult[] = [];
let currentSection = "";

function section(title: string) {
  currentSection = title;
  console.log(`\n== ${title}`);
}

async function check(name: string, run: () => Promise<void | string>) {
  try {
    const detail = await run();
    results.push({ name: `${currentSection} / ${name}`, ok: true, ...(detail ? { detail } : {}) });
    console.log(`  GECTI  ${name}${detail ? `  (${detail})` : ""}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name: `${currentSection} / ${name}`, ok: false, detail });
    console.log(`  KALDI  ${name}\n         ${detail}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectOk<T>(result: QueryResult<T>, label: string): T {
  assert(!result.error, `${label}: ${result.error?.code} ${result.error?.message}`);
  return result.data;
}

async function main() {
  const health = await fetch(new URL("/api/health", baseUrl)).catch(() => null);
  if (!health?.ok) throw new Error(`${baseUrl} yanit vermiyor. Once \`pnpm dev:admin\` ile uygulamayi baslatin.`);

  const runId = Date.now().toString(36);
  const platform = new WebSession("admin");
  const adminA = new WebSession("admin");
  const personnel = new WebSession("personnel");
  const adminB = new WebSession("admin");
  const anonymous = new WebSession("admin");
  const ids: Record<string, string> = {};

  section("Kimlik dogrulama ve oturum");

  await check("anonim kullanici yayindaki paketleri okuyabilir", async () => {
    const result = await anonymous.db.from("plans").select("id,name").eq("is_public", true);
    expectOk(result, "plans");
  });

  await check("anonim kullanici firma verisine erisemez", async () => {
    const result = await anonymous.db.from("companies").select("id");
    assert(result.error?.code === "operation_not_allowed" && result.status === 401, `beklenmeyen yanit: ${JSON.stringify(result.error)}`);
  });

  await check("platform sahibi girisi /platform alanina yonlenir", async () => {
    const { response, body } = await platform.login(required("E2E_PLATFORM_EMAIL"), required("E2E_PLATFORM_PASSWORD"));
    assert(response.ok && body.redirectTo === "/platform" && body.scope === "admin", `giris basarisiz: ${response.status} ${JSON.stringify(body)}`);
    const setCookie = response.headers.getSetCookie().join("\n");
    assert(/HttpOnly/i.test(setCookie) && /SameSite=strict/i.test(setCookie), "oturum cerezi HttpOnly + SameSite=Strict degil");
    return "cerez HttpOnly, SameSite=Strict";
  });

  await check("yanlis parola genel mesajla reddedilir", async () => {
    const { response, body } = await new WebSession("admin").login(required("E2E_PLATFORM_EMAIL"), "yanlis-parola-123");
    assert(response.status === 401 && body.message?.startsWith("Giriş yapılamadı"), `beklenmeyen yanit: ${response.status}`);
  });

  await check("baska kaynaktan gelen web girisi reddedilir (CSRF)", async () => {
    const response = await new WebSession("admin", "https://evil.example").fetch("/api/auth/login", {
      method: "POST",
      json: { email: required("E2E_PLATFORM_EMAIL"), password: required("E2E_PLATFORM_PASSWORD") },
      scopeHeader: false
    });
    assert(response.status === 403, `beklenen 403, gelen ${response.status}`);
  });

  section("Platform yonetimi ve ikinci kiraci");

  const tenantBEmail = `tenant-b-${runId}@example.test`;
  const tenantBPassword = `TenantB-${runId}-Parola!`;

  await check("platform panosu acilir", async () => {
    const response = await platform.fetch("/api/platform/dashboard");
    assert(response.ok, `dashboard ${response.status}`);
  });

  await check("ikinci firma (B) kaydi tek transaction ile olusur", async () => {
    const response = await anonymous.fetch("/api/auth/register", {
      method: "POST",
      scopeHeader: false,
      json: {
        organization_name: `B Kiraci ${runId}`,
        first_name: "Bora",
        last_name: "Kiraci",
        email: tenantBEmail,
        password: tenantBPassword,
        billing_interval: "monthly",
        terms_accepted: true
      }
    });
    assert(response.status === 201, `kayit ${response.status} ${await response.text()}`);
  });

  await check("platform sahibi B firmasina omur boyu erisim verir", async () => {
    const list = await platform.fetch("/api/platform/dashboard");
    const dashboard = await list.json() as { organizations?: { id: string; billing_email?: string | null; billingEmail?: string | null }[] };
    const organization = dashboard.organizations?.find((item) => (item.billing_email ?? item.billingEmail) === tenantBEmail);
    assert(organization, "B firmasi platform listesinde bulunamadi");
    ids.organizationB = organization.id;
    for (const action of ["grant_lifetime", "activate"]) {
      const response = await platform.fetch(`/api/platform/organizations/${organization.id}`, { method: "PATCH", json: { action } });
      assert(response.ok, `${action}: ${response.status} ${await response.text()}`);
    }
  });

  section("Firma yoneticisi (A kiracisi)");

  await check("firma yoneticisi girisi /app alanina yonlenir", async () => {
    const { response, body } = await adminA.login(required("E2E_ADMIN_EMAIL"), required("E2E_ADMIN_PASSWORD"));
    assert(response.ok && body.redirectTo === "/app", `giris: ${response.status} ${JSON.stringify(body)}`);
  });

  await check("hesap erisim modu yazma", async () => {
    const response = await adminA.fetch("/api/account/access");
    const body = await response.json() as { accessMode?: string; role?: string };
    assert(response.ok && body.accessMode === "write" && body.role === "ADMIN", `erisim: ${response.status} ${JSON.stringify(body)}`);
  });

  await check("musteri firma, hat, bant ve arac kaydedilir (RLS + otomatik organizasyon)", async () => {
    const company = expectOk(await adminA.db.from("companies")
      .insert({ name: `E2E Musteri ${runId}`, contact_name: "Can Musteri", contact_phone: "05550000000" })
      .select("id,organization_id").single(), "company");
    ids.company = company.id;
    ids.organizationA = company.organization_id;
    expectOk(await adminA.db.from("company_lines").insert({ company_id: company.id, name: "Hat 1" }), "line");
    const belt = expectOk(await adminA.db.from("belts").insert({ code: `BNT-${runId}`, name: "E2E Bant" }).select("id").single(), "belt");
    ids.belt = belt.id;
    expectOk(await adminA.db.from("vehicles").insert({ plate: `34 E2E ${runId.slice(-3)}` }), "vehicle");
  });

  await check("ekipman yonetici API'si ile eklenir", async () => {
    const response = await adminA.fetch("/api/admin/equipment", { method: "POST", json: { name: `E2E Pres ${runId}`, description: "Test", is_active: true } });
    assert(response.ok, `equipment ${response.status} ${await response.text()}`);
  });

  await check("personel hesabi olusturulur (veya zaten vardir)", async () => {
    const response = await adminA.fetch("/api/admin/personnel/create-account", {
      method: "POST",
      json: {
        first_name: "Saha",
        last_name: "Personel",
        email: required("E2E_PERSONNEL_EMAIL"),
        phone: "",
        password: required("E2E_PERSONNEL_PASSWORD"),
        role: "PERSONNEL",
        is_active: true
      }
    });
    assert(response.ok || response.status === 409, `personel ${response.status} ${await response.text()}`);
    return response.status === 409 ? "zaten mevcut" : "olusturuldu";
  });

  section("Saha personeli rapor akisi");

  await check("personel girisi /personel alanina ve personel oturumuna yonlenir", async () => {
    const { response, body } = await personnel.login(required("E2E_PERSONNEL_EMAIL"), required("E2E_PERSONNEL_PASSWORD"));
    assert(response.ok && body.scope === "personnel" && body.redirectTo === "/personel", `giris: ${response.status} ${JSON.stringify(body)}`);
  });

  await check("personel musteri firma ekleyemez (RLS)", async () => {
    const result = await personnel.db.from("companies").insert({ name: "Yetkisiz Firma" });
    assert(result.error, "personel firma ekleyebildi");
    return result.error.code;
  });

  const clientRequestId = crypto.randomUUID();
  await check("taslak rapor kaydedilir (upsert, organizasyon ve olusturan sunucuda atanir)", async () => {
    const draft = expectOk(await personnel.db.from("reports").upsert({
      client_request_id: clientRequestId,
      customer_signature_required: true,
      status: "DRAFT",
      report_date: new Date().toISOString().slice(0, 10),
      company_id: ids.company,
      belt_id: ids.belt,
      line_name: "Hat 1",
      work_items: [{ belt_id: ids.belt, line_name: "Hat 1" }],
      product_types: [],
      process_actions: [],
      replacement_reasons: [],
      process_description: "E2E test montaji"
    }, { onConflict: "client_request_id" }).select("id,status,updated_at,organization_id,created_by_name_snapshot").single(), "draft");
    assert(draft.organization_id === ids.organizationA, "rapor yanlis organizasyona yazildi");
    ids.report = draft.id;
    ids.reportUpdatedAt = draft.updated_at;
    return `olusturan: ${draft.created_by_name_snapshot}`;
  });

  await check("rapor personeli eklenir", async () => {
    const session = await personnel.fetch("/api/auth/session");
    const { user } = await session.json() as { user: { id: string } };
    ids.personnelUser = user.id;
    expectOk(await personnel.db.from("report_personnel").insert({ report_id: ids.report, profile_id: user.id, name_snapshot: "Saha Personel" }), "report_personnel");
  });

  const photoPath = () => `${ids.organizationA}/${ids.report}/e2e-${runId}.png`;
  await check("fotograf yuklenir (RLS yol kontrolu + icerik dogrulama)", async () => {
    const response = await personnel.fetch(`/api/storage/object/report-photos/${photoPath()}`, {
      method: "POST",
      body: new Uint8Array(PNG_1X1),
      headers: { "Content-Type": "image/png" }
    });
    assert(response.status === 201, `upload ${response.status} ${await response.text()}`);
    expectOk(await personnel.db.from("report_photos").insert({
      report_id: ids.report,
      storage_path: photoPath(),
      category: "Genel",
      caption: "E2E",
      created_by: ids.personnelUser
    }), "report_photos");
  });

  await check("uzantisi PNG olan sahte dosya reddedilir", async () => {
    const response = await personnel.fetch(`/api/storage/object/report-photos/${ids.organizationA}/${ids.report}/sahte-${runId}.png`, {
      method: "POST",
      body: new TextEncoder().encode("MZ-bu-bir-calistirilabilir-dosya"),
      headers: { "Content-Type": "image/png" }
    });
    assert(response.status === 415, `beklenen 415, gelen ${response.status}`);
  });

  await check("baska firmanin klasorune dosya yuklenemez (RLS)", async () => {
    assert(ids.organizationB, "B firmasi kimligi yok");
    const response = await personnel.fetch(`/api/storage/object/report-photos/${ids.organizationB}/${ids.report}/sizinti-${runId}.png`, {
      method: "POST",
      body: new Uint8Array(PNG_1X1),
      headers: { "Content-Type": "image/png" }
    });
    assert(response.status === 403, `beklenen 403, gelen ${response.status}`);
  });

  let signedUrl = "";
  await check("imzali baglanti ile fotograf indirilir", async () => {
    const response = await personnel.fetch("/api/storage/sign", { method: "POST", json: { bucket: "report-photos", paths: [photoPath()], expiresIn: 300 } });
    const body = await response.json() as { data?: { signedUrl: string | null }[] };
    signedUrl = body.data?.[0]?.signedUrl ?? "";
    assert(signedUrl, `imzali baglanti yok: ${response.status}`);
    const download = await fetch(new URL(signedUrl, baseUrl));
    const bytes = Buffer.from(await download.arrayBuffer());
    assert(download.ok && bytes.equals(PNG_1X1), `indirme ${download.status}, ${bytes.length} bayt`);
    assert(download.headers.get("x-content-type-options") === "nosniff", "nosniff basligi yok");
  });

  await check("degistirilmis imzali baglanti reddedilir", async () => {
    const tampered = signedUrl.replace(/sig=([A-Za-z0-9_-])/, (_match, first: string) => `sig=${first === "A" ? "B" : "A"}`);
    const response = await fetch(new URL(tampered, baseUrl));
    assert(response.status === 403, `beklenen 403, gelen ${response.status}`);
  });

  await check("musteri imzasi ile rapor gonderilir ve rapor numarasi uretilir", async () => {
    const submitted = expectOk(await personnel.db.from("reports")
      .update({ status: "SUBMITTED", customer_signature: VALID_SIGNATURE })
      .eq("id", ids.report).eq("status", "DRAFT").eq("updated_at", ids.reportUpdatedAt)
      .select("id,report_number,status,customer_signed_at").single(), "submit");
    assert(submitted.status === "SUBMITTED" && /^RPR-\d{4}-\d{6}$/.test(submitted.report_number), `rapor: ${JSON.stringify(submitted)}`);
    assert(submitted.customer_signed_at, "imza zamani veritabaninda atanmadi");
    return submitted.report_number;
  });

  await check("imzali rapor sonradan degistirilemez", async () => {
    const result = await personnel.db.from("reports").update({ process_description: "kurcalama" }).eq("id", ids.report).select("id");
    const rows = (result.data as unknown[] | null) ?? [];
    assert(result.error || rows.length === 0, "imzali rapor guncellendi");
  });

  section("Yonetici rapor incelemesi");

  await check("rapor alt kayitlariyla listelenir (iliskili secim)", async () => {
    const report = expectOk(await adminA.db.from("reports")
      .select("*, report_personnel(name_snapshot), report_photos(id,category,caption,storage_path)")
      .eq("id", ids.report).single(), "report");
    assert(report.report_personnel?.length === 1 && report.report_photos?.length === 1, `alt kayitlar: ${JSON.stringify({ p: report.report_personnel, f: report.report_photos })}`);
  });

  await check("PDF raporu uretilir", async () => {
    const response = await adminA.fetch(`/api/reports/${ids.report}/pdf`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(response.ok && bytes.subarray(0, 4).toString() === "%PDF", `pdf ${response.status} ${response.headers.get("content-type")}`);
    return `${Math.round(bytes.length / 1024)} KB`;
  });

  await check("Excel disa aktarimi uretilir", async () => {
    const response = await adminA.fetch(`/api/admin/reports/export?id=${ids.report}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(response.ok && bytes.subarray(0, 2).toString() === "PK", `excel ${response.status} ${response.headers.get("content-type")}`);
  });

  section("Kiraci izolasyonu (A <-> B)");

  await check("B yoneticisi giris yapar", async () => {
    const { response, body } = await adminB.login(tenantBEmail, tenantBPassword);
    assert(response.ok && body.redirectTo === "/app", `giris: ${response.status} ${JSON.stringify(body)}`);
  });

  await check("B, A firmasinin raporlarini ve musterilerini goremez", async () => {
    const reports = expectOk(await adminB.db.from("reports").select("id"), "reports") as unknown[];
    const companies = expectOk(await adminB.db.from("companies").select("id").eq("id", ids.company), "companies") as unknown[];
    assert(reports.length === 0 && companies.length === 0, `sizinti: ${reports.length} rapor, ${companies.length} firma`);
  });

  await check("B, A firmasinin kaydini guncelleyemez", async () => {
    const result = await adminB.db.from("companies").update({ name: "ele gecirildi" }).eq("id", ids.company).select("id");
    const rows = (result.data as unknown[] | null) ?? [];
    assert(rows.length === 0, "B, A kaydini guncelledi");
    const check = expectOk(await adminA.db.from("companies").select("name").eq("id", ids.company).single(), "company");
    assert(check.name !== "ele gecirildi", "A kaydi degisti");
  });

  await check("B, A raporunun PDF'ini alamaz", async () => {
    const response = await adminB.fetch(`/api/reports/${ids.report}/pdf`);
    assert(!response.ok, `beklenen hata, gelen ${response.status}`);
    return String(response.status);
  });

  await check("B, A fotografi icin imzali baglanti uretemez", async () => {
    const response = await adminB.fetch("/api/storage/sign", { method: "POST", json: { bucket: "report-photos", paths: [photoPath()], expiresIn: 60 } });
    const body = await response.json() as { data?: { signedUrl: string | null }[] };
    assert(!body.data?.[0]?.signedUrl, "B icin imzali baglanti uretildi");
  });

  section("Veri gecidi sertlestirmesi");

  await check("izin listesinde olmayan tablo reddedilir", async () => {
    const result = await adminA.db.from("payment_events").select("id");
    assert(result.error?.code === "operation_not_allowed", JSON.stringify(result.error));
  });

  await check("sema disi tablo adi reddedilir", async () => {
    const response = await adminA.fetch("/api/data", { method: "POST", json: { table: "auth.users", action: "select", filters: [], order: [] } });
    assert(response.status === 400, `beklenen 400, gelen ${response.status}`);
  });

  await check("kolon adi ile SQL enjeksiyonu reddedilir", async () => {
    const result = await adminA.db.from("companies").select("id,name;drop table companies");
    assert(result.error, "enjeksiyon denemesi hata vermedi");
  });

  await check("filtresiz toplu silme engellenir", async () => {
    const result = await adminA.db.from("vehicles").delete();
    assert(result.error?.code === "query_invalid", JSON.stringify(result.error));
  });

  await check("1000 satir ustu istek reddedilir", async () => {
    const result = await adminA.db.from("companies").select("id").limit(5000);
    assert(result.error, "limit asimi kabul edildi");
  });

  await check("baska kaynaktan cerezli yazma istegi reddedilir (CSRF)", async () => {
    const response = await fetch(new URL("/api/data", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auth-Scope": "admin", Cookie: adminA.cookieHeader(), Origin: "https://evil.example" },
      body: JSON.stringify({ table: "companies", action: "insert", values: { name: "csrf" }, filters: [], order: [] })
    });
    assert(response.status === 401, `beklenen 401, gelen ${response.status}`);
  });

  await check("web oturum belirteci Bearer olarak kullanilamaz", async () => {
    const token = [...new Set(["ops_admin_session", "__Host-ops_admin_session"])].map((name) => adminA.cookieValue(name)).find(Boolean);
    assert(token, "web oturum cerezi bulunamadi");
    const response = await fetch(new URL("/api/auth/session", baseUrl), { headers: { Authorization: `Bearer ${token}` } });
    assert(response.status === 401, `beklenen 401, gelen ${response.status}`);
  });

  section("Mobil istemci ve oturum sonlandirma");

  await check("mobil giris Bearer belirteci dondurur ve calisir", async () => {
    const response = await fetch(new URL("/api/auth/login", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: required("E2E_PERSONNEL_EMAIL"), password: required("E2E_PERSONNEL_PASSWORD"), client: "mobile" })
    });
    const body = await response.json() as { access_token?: string };
    assert(response.ok && body.access_token, `mobil giris ${response.status}`);
    const session = await fetch(new URL("/api/auth/session", baseUrl), { headers: { Authorization: `Bearer ${body.access_token}` } });
    assert(session.ok, `bearer oturumu ${session.status}`);
    const logout = await fetch(new URL("/api/auth/logout", baseUrl), { method: "POST", headers: { Authorization: `Bearer ${body.access_token}` } });
    assert(logout.ok, `mobil cikis ${logout.status}`);
    const after = await fetch(new URL("/api/auth/session", baseUrl), { headers: { Authorization: `Bearer ${body.access_token}` } });
    assert(after.status === 401, `cikis sonrasi belirtec hala gecerli: ${after.status}`);
  });

  await check("cikis sonrasi ayni cerez sunucuda gecersizdir", async () => {
    const cookie = adminA.cookieHeader();
    const logout = await adminA.fetch("/api/auth/logout", { method: "POST", json: {} });
    assert(logout.ok, `cikis ${logout.status}`);
    const replay = await fetch(new URL("/api/auth/session", baseUrl), { headers: { Cookie: cookie, "X-Auth-Scope": "admin" } });
    assert(replay.status === 401, `eski cerez hala gecerli: ${replay.status}`);
  });

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length} kontrol, ${results.length - failed.length} gecti, ${failed.length} kaldi.`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
