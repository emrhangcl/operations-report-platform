import { NextResponse } from "next/server";
import { equipmentSchema } from "@operations/validation";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { requireAdmin } from "../../../../../lib/server/guards";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const rateLimited = enforceRateLimit(request, "admin-equipment-update");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request, "write");
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: admin.status });
  }

  const parsed = equipmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Ekipman bilgileri geçersiz." }, { status: 400 });
  }

  const { id } = await params;
  const { data, error } = await admin.service
    .from("equipment")
    .update({ ...parsed.data, description: parsed.data.description || null })
    .eq("id", id)
    .eq("organization_id", admin.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: "Ekipman güncellenemedi. Aynı ekipman adı kayıtlı olabilir." }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ message: "Ekipman bulunamadı." }, { status: 404 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "equipment_updated",
    entity_table: "equipment",
    entity_id: id
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const rateLimited = enforceRateLimit(request, "admin-equipment-delete");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request, "write");
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: admin.status });
  }

  const { id } = await params;
  const { data, error } = await admin.service
    .from("equipment")
    .delete()
    .eq("id", id)
    .eq("organization_id", admin.organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: "Ekipman silinemedi." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "Ekipman bulunamadı." }, { status: 404 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "equipment_deleted",
    entity_table: "equipment",
    entity_id: id
  });

  return NextResponse.json({ ok: true });
}
