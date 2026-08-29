import { z } from "zod";
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../../../lib/supabase-server";
import { enforceRateLimit } from "../../../../../../lib/rate-limit";
import { readJsonBody } from "../../../../../../lib/request-body";

export const runtime = "nodejs";

const organizationIdSchema = z.string().uuid();
const requestSchema = z.object({ scope: z.literal("organization").default("organization") }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = enforceRateLimit(request, "platform-organization-export");
  if (rateLimited) return rateLimited;

  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const { id } = await params;
  if (!organizationIdSchema.safeParse(id).success) {
    return NextResponse.json({ message: "Firma kimliği geçersiz." }, { status: 400 });
  }

  const bodyResult = await readJsonBody(request, 4 * 1024);
  if (!bodyResult.ok) return NextResponse.json({ message: bodyResult.message }, { status: bodyResult.status });

  const body: unknown = bodyResult.value;

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
