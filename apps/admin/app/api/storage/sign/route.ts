import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { readJsonBody } from "../../../../lib/request-body";
import { authenticateRequest } from "../../../../lib/server/auth/http";
import { createStorageApi } from "../../../../lib/server/storage";

export const runtime = "nodejs";

const schema = z.object({
  bucket: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  paths: z.array(z.string().min(1).max(512)).min(1).max(100),
  expiresIn: z.number().int().min(1).max(7 * 24 * 60 * 60)
});

// Imzali baglanti yalnizca kullanicinin RLS ile gorebildigi nesneler icin uretilir.
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ message: "Oturum bulunamadı." }, { status: 401 });

  const rateLimited = enforceRateLimit(request, "storage-sign", { limit: 300, identity: auth.session.userId });
  if (rateLimited) return rateLimited;

  const body = await readJsonBody(request, 64 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ message: "Geçersiz dosya isteği." }, { status: 400 });

  const result = await createStorageApi({ role: "authenticated", userId: auth.session.userId })
    .from(parsed.data.bucket)
    .createSignedUrls(parsed.data.paths, parsed.data.expiresIn);
  if (result.error) return NextResponse.json({ message: result.error.message }, { status: result.error.statusCode });
  return NextResponse.json({ data: result.data }, { headers: { "Cache-Control": "no-store" } });
}
