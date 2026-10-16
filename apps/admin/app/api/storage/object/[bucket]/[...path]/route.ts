import { NextResponse } from "next/server";
import { enforceRateLimit } from "../../../../../../lib/rate-limit";
import { authenticateRequest } from "../../../../../../lib/server/auth/http";
import { createStorageApi, readObjectForSignedUrl, verifySignedObject } from "../../../../../../lib/server/storage";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type RouteParams = { params: Promise<{ bucket: string; path: string[] }> };

async function objectName(params: RouteParams["params"]) {
  const { bucket, path } = await params;
  return { bucket, name: path.join("/") };
}

// Imzali indirme: imza kova + yol + son kullanma zamanini baglar. Oturum gerektirmez; boylece
// <img src> ile kullanilabilir ve baglanti suresi dolunca gecersizlesir.
export async function GET(request: Request, { params }: RouteParams) {
  const { bucket, name } = await objectName(params);
  const url = new URL(request.url);
  if (!verifySignedObject(bucket, name, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return NextResponse.json({ message: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 403 });
  }

  try {
    const object = await readObjectForSignedUrl(bucket, name);
    if (!object) return NextResponse.json({ message: "Dosya bulunamadı." }, { status: 404 });
    const remaining = Math.max(0, Number(url.searchParams.get("exp")) - Math.floor(Date.now() / 1000));
    return new Response(new Uint8Array(object.body), {
      headers: {
        "Content-Type": object.contentType,
        "Content-Length": String(object.body.byteLength),
        "Cache-Control": `private, max-age=${Math.min(remaining, 3600)}`,
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin"
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      return NextResponse.json({ message: "Dosya bulunamadı." }, { status: 404 });
    }
    return NextResponse.json({ message: "Dosya okunamadı." }, { status: 400 });
  }
}

// Oturumlu yukleme: storage.objects uzerindeki RLS politikasi yolun kullanicinin organizasyonuna
// ve raporuna ait oldugunu dogrular; ancak bundan sonra dosya diske yazilir.
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await authenticateRequest(request);
  if (!auth) return NextResponse.json({ message: "Oturum bulunamadı." }, { status: 401 });

  const rateLimited = await enforceRateLimit(request, "storage-upload", { limit: 120, identity: auth.session.userId });
  if (rateLimited) return rateLimited;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ message: "Dosya çok büyük." }, { status: 413 });
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ message: bytes.byteLength === 0 ? "Dosya boş." : "Dosya çok büyük." }, { status: bytes.byteLength === 0 ? 400 : 413 });
  }

  const { bucket, name } = await objectName(params);
  const upsert = new URL(request.url).searchParams.get("upsert") === "true";
  const contentType = request.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const result = await createStorageApi({ role: "authenticated", userId: auth.session.userId })
    .from(bucket)
    .upload(name, bytes, { contentType, upsert });

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: result.error.statusCode });
  }
  return NextResponse.json({ path: result.data.path }, { status: 201 });
}
