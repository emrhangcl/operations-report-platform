import { z } from "zod";
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../../../lib/supabase-server";

export const runtime = "nodejs";

const organizationIdSchema = z.string().uuid();
const requestSchema = z.object({ scope: z.literal("organization").default("organization") }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const { id } = await params;
  if (!organizationIdSchema.safeParse(id).success) {
    return NextResponse.json({ message: "Firma kimliği geçersiz." }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dışa aktarma talebi geçersiz." }, { status: 400 });
  }

  const result = await auth.service.rpc("platform_create_export_request", {
    target_organization_id: id,
    target_scope: parsed.data.scope,
    actor_user_id: auth.userId
  });

  if (result.error) {
    return NextResponse.json({ message: "Dışa aktarma talebi oluşturulamadı." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, request: result.data }, { status: 201 });
}
