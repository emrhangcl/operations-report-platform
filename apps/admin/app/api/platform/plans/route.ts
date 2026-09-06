import { NextResponse } from "next/server";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { readJsonBody } from "../../../../lib/request-body";
import { requirePlatformAdmin } from "../../../../lib/supabase-server";
import { planRow, planSchema } from "./schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "platform-plans-read");
  if (rateLimited) return rateLimited;
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: 403 });

  const result = await auth.service
    .from("plans")
    .select("id,code,name,description,currency,monthly_price_minor,yearly_price_minor,is_active,is_public,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (result.error) return NextResponse.json({ message: "Paketler alınamadı." }, { status: 500 });
  return NextResponse.json({ plans: result.data ?? [] });
}

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "platform-plans-create");
  if (rateLimited) return rateLimited;
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: 403 });

  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok) return NextResponse.json({ message: "Geçerli paket bilgileri gönderin." }, { status: body.status });
  const parsed = planSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ message: "Paket alanlarını ve fiyatları kontrol edin." }, { status: 400 });

  const result = await auth.service.from("plans").insert(planRow(parsed.data)).select().single();
  if (result.error) {
    const message = result.error.code === "23505" ? "Bu paket kodu daha önce kullanılmış." : "Paket oluşturulamadı.";
    return NextResponse.json({ message }, { status: 400 });
  }

  const actor = await auth.service.from("profiles").select("id").eq("id", auth.userId).maybeSingle();
  await auth.service.from("audit_logs").insert({
    actor_id: actor.data?.id ?? null,
    action: "platform.plan.created",
    entity_table: "plans",
    entity_id: result.data.id,
    after_data: result.data
  });

  return NextResponse.json({ plan: result.data }, { status: 201 });
}
