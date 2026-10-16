import { z } from "zod";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { readJsonBody } from "../../../../../lib/request-body";
import { requirePlatformAdmin } from "../../../../../lib/server/guards";
import { planRow, planSchema } from "../schema";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

async function planId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return idSchema.safeParse(id).success ? id : null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = enforceRateLimit(request, "platform-plans-update");
  if (rateLimited) return rateLimited;
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  const id = await planId(params);
  if (!id) return NextResponse.json({ message: "Paket kimliği geçersiz." }, { status: 400 });

  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok) return NextResponse.json({ message: "Geçerli paket bilgileri gönderin." }, { status: body.status });
  const parsed = planSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ message: "Paket alanlarını ve fiyatları kontrol edin." }, { status: 400 });

  const before = await auth.service.from("plans").select("*").eq("id", id).maybeSingle();
  if (!before.data) return NextResponse.json({ message: "Paket bulunamadı." }, { status: 404 });

  const result = await auth.service.from("plans").update(planRow(parsed.data)).eq("id", id).select().single();
  if (result.error) {
    const message = result.error.code === "23505" ? "Bu paket kodu başka bir pakette kullanılıyor." : "Paket güncellenemedi.";
    return NextResponse.json({ message }, { status: 400 });
  }

  const actor = await auth.service.from("profiles").select("id").eq("id", auth.userId).maybeSingle();
  await auth.service.from("audit_logs").insert({ actor_id: actor.data?.id ?? null, action: "platform.plan.updated", entity_table: "plans", entity_id: id, before_data: before.data, after_data: result.data });
  return NextResponse.json({ plan: result.data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = enforceRateLimit(request, "platform-plans-delete");
  if (rateLimited) return rateLimited;
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });
  const id = await planId(params);
  if (!id) return NextResponse.json({ message: "Paket kimliği geçersiz." }, { status: 400 });

  const before = await auth.service.from("plans").select("*").eq("id", id).maybeSingle();
  if (!before.data) return NextResponse.json({ message: "Paket bulunamadı." }, { status: 404 });
  const usage = await auth.service.from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", id);
  if (usage.error) return NextResponse.json({ message: "Paket kullanımı kontrol edilemedi." }, { status: 500 });

  const archived = (usage.count ?? 0) > 0;
  const result = archived
    ? await auth.service.from("plans").update({ is_active: false, is_public: false }).eq("id", id)
    : await auth.service.from("plans").delete().eq("id", id);
  if (result.error) return NextResponse.json({ message: "Paket kaldırılamadı." }, { status: 400 });

  const actor = await auth.service.from("profiles").select("id").eq("id", auth.userId).maybeSingle();
  await auth.service.from("audit_logs").insert({ actor_id: actor.data?.id ?? null, action: archived ? "platform.plan.archived" : "platform.plan.deleted", entity_table: "plans", entity_id: id, before_data: before.data });
  return NextResponse.json({ ok: true, archived });
}
