import { NextResponse } from "next/server";
import { equipmentSchema } from "@operations/validation";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { requireAdmin } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "admin-equipment-create");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request, "write");
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const parsed = equipmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Ekipman bilgileri geçersiz." }, { status: 400 });
  }

  const { data, error } = await admin.service
    .from("equipment")
    .insert({
      ...parsed.data,
      description: parsed.data.description || null,
      organization_id: admin.organizationId
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "Ekipman kaydedilemedi. Aynı ekipman adı kayıtlı olabilir." }, { status: 400 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "equipment_created",
    entity_table: "equipment",
    entity_id: data.id
  });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
