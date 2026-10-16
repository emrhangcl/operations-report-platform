import { NextResponse } from "next/server";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { requirePlatformAdmin } from "../../../../lib/server/guards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimited = await enforceRateLimit(request, "platform-logs-read");
  if (rateLimited) return rateLimited;
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") ?? "1");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 15;
  const entityTable = (url.searchParams.get("table") ?? "").trim();
  const action = (url.searchParams.get("action") ?? "").trim().slice(0, 100);
  const from = (page - 1) * pageSize;

  let query = auth.service
    .from("audit_logs")
    .select("id,organization_id,actor_id,action,entity_table,entity_id,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (entityTable && /^[a-z0-9_]+$/.test(entityTable)) query = query.eq("entity_table", entityTable);
  if (action) query = query.ilike("action", `%${action}%`);

  const result = await query;
  if (result.error) return NextResponse.json({ message: "Sistem kayıtları alınamadı." }, { status: 500 });
  const organizationIds = Array.from(new Set((result.data ?? []).map((log) => log.organization_id).filter(Boolean)));
  const organizations = organizationIds.length
    ? await auth.service.from("organizations").select("id,name").in("id", organizationIds)
    : { data: [], error: null };
  if (organizations.error) return NextResponse.json({ message: "Firma bilgileri alınamadı." }, { status: 500 });
  const names = new Map((organizations.data ?? []).map((organization) => [organization.id, organization.name]));

  return NextResponse.json({
    logs: (result.data ?? []).map((log) => ({
      id: log.id,
      organizationId: log.organization_id,
      organizationName: names.get(log.organization_id ?? "") ?? "Platform",
      actorId: log.actor_id,
      action: log.action,
      entityTable: log.entity_table,
      entityId: log.entity_id,
      createdAt: log.created_at
    })),
    page,
    pageSize,
    total: result.count ?? 0
  });
}
