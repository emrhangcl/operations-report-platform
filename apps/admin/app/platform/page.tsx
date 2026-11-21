"use client";

import { Skeleton } from "@/components/shadcn/skeleton";
import { OverviewActivityChart } from "./_components/overview-activity-chart";
import { OverviewOrganizationsTable } from "./_components/overview-organizations-table";
import { OverviewSectionCards } from "./_components/overview-section-cards";
import { usePlatformDashboard } from "./_components/platform-client";

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Panel yükleniyor" className="flex flex-col gap-4 md:gap-6" role="status">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton className="h-[138px] rounded-xl" key={item} />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    </div>
  );
}

// shadcn dashboard-01 "page.tsx" birebir: kartlar, grafik, tablo.
export default function PlatformOverviewPage() {
  const { data, error, loading } = usePlatformDashboard();

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {error ? (
          <div className="mx-4 rounded-lg border border-destructive/50 px-4 py-3 text-sm text-destructive lg:mx-6" role="alert">
            {error}
          </div>
        ) : null}
        {loading ? (
          <OverviewSkeleton />
        ) : (
          <>
            <OverviewSectionCards activity={data.activity} metrics={data.metrics} />
            <div className="px-4 lg:px-6">
              <OverviewActivityChart activity={data.activity} />
            </div>
            <OverviewOrganizationsTable organizations={data.organizations} plans={data.plans} />
          </>
        )}
      </div>
    </div>
  );
}
