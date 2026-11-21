"use client";

import { IconChevronLeft, IconChevronRight, IconPlus } from "@tabler/icons-react";
import type { InstallationAssignment, Profile } from "@operations/types";
import { Button, EmptyState, FormSection, PageHeaderShell } from "@/components/firm-ui";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import {
  assignmentWorkItemsText,
  formatDateDisplay,
  formatDateValue,
  reportWorkItemsText,
  type ReportRow
} from "./report-utils";

const countFormat = new Intl.NumberFormat("tr-TR");

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <Button icon={<IconChevronLeft aria-hidden />} onClick={onBack} variant="secondary">
        Geri
      </Button>
    </div>
  );
}

// shadcn "item-demo": outline Item, tum satir tek dugme.
function ListItem({ description, meta, onClick, title }: { description: string; meta: string; onClick: () => void; title: string }) {
  return (
    <Item asChild className="w-full text-left hover:bg-accent/50" variant="outline">
      <button onClick={onClick} type="button">
        <ItemContent className="min-w-0">
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
          <ItemDescription>{meta}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <IconChevronRight aria-hidden className="size-4 text-muted-foreground" />
        </ItemActions>
      </button>
    </Item>
  );
}

function assignmentStatusText(assignment: InstallationAssignment, draftLabel: string) {
  return assignment.report_id ? draftLabel : assignment.status === "IN_PROGRESS" ? "Devam ediyor" : "Atandı";
}

function AssignmentItem({ assignment, draftLabel, onOpen }: { assignment: InstallationAssignment; draftLabel: string; onOpen: () => void }) {
  return (
    <ListItem
      description={[assignment.company_name_snapshot, assignmentWorkItemsText(assignment)].filter(Boolean).join(" / ") || "Firma bilgisi yok"}
      meta={`${assignmentStatusText(assignment, draftLabel)} · ${assignment.scheduled_date ? formatDateDisplay(assignment.scheduled_date) : "Tarih seçilmedi"}`}
      onClick={onOpen}
      title={assignment.title}
    />
  );
}

// shadcn dashboard-01 "SectionCards" yapisi; kartin tamami ilgili listeyi acar.
function PersonnelSectionCards({
  assignmentCount,
  draftCount,
  onAssignments,
  onDrafts,
  onSubmitted,
  submittedCount
}: {
  assignmentCount: number;
  draftCount: number;
  onAssignments: () => void;
  onDrafts: () => void;
  onSubmitted: () => void;
  submittedCount: number;
}) {
  const cards = [
    { label: "Montaj", value: assignmentCount, footer: "Atanmış veya sahada devam eden", detail: "Montajlarım", onClick: onAssignments },
    { label: "Taslak", value: draftCount, footer: "Gönderilmeyi bekliyor", detail: "Taslaklarım", onClick: onDrafts },
    { label: "Gönderilen", value: submittedCount, footer: "İmzalı ve gönderilmiş", detail: "Gönderdiğim Raporlar", onClick: onSubmitted }
  ];
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card className="@container/card relative has-[button:focus-visible]:ring-[3px] has-[button:focus-visible]:ring-ring/50" key={card.label}>
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{countFormat.format(card.value)}</CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">{card.footer}</div>
            <button
              className="text-muted-foreground outline-none after:absolute after:inset-0 after:rounded-xl"
              onClick={card.onClick}
              type="button"
            >
              {card.detail}
            </button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export function PersonnelHome({
  assignmentCount,
  assignments,
  draftCount,
  drafts,
  onAssignments,
  onAssignmentOpen,
  onDrafts,
  onDraftOpen,
  onNewReport,
  onSubmitted,
  profile,
  readOnlyMode,
  submittedCount
}: {
  assignmentCount: number;
  assignments: InstallationAssignment[];
  draftCount: number;
  drafts: ReportRow[];
  onAssignments: () => void;
  onAssignmentOpen: (assignment: InstallationAssignment) => void;
  onDrafts: () => void;
  onDraftOpen: (report: ReportRow) => void;
  onNewReport: () => void;
  onSubmitted: () => void;
  profile: Profile | null;
  readOnlyMode: boolean;
  submittedCount: number;
}) {
  const firstName = profile?.first_name?.trim() || "Personel";
  const nextAssignments = assignments.slice(0, 3);
  const nextDrafts = drafts.slice(0, 3);

  return (
    <>
      <PageHeaderShell
        action={
          <Button disabled={readOnlyMode} icon={<IconPlus aria-hidden />} onClick={onNewReport}>
            Yeni Rapor
          </Button>
        }
        description={formatDateDisplay(formatDateValue(new Date()))}
        eyebrow="Saha çalışma alanı"
        title={`Merhaba ${firstName}`}
      />

      <PersonnelSectionCards
        assignmentCount={assignmentCount}
        draftCount={draftCount}
        onAssignments={onAssignments}
        onDrafts={onDrafts}
        onSubmitted={onSubmitted}
        submittedCount={submittedCount}
      />

      <FormSection title="İş Sırası">
        {nextAssignments.length === 0 ? (
          <EmptyState className="rounded-lg border border-dashed py-8" title="Aktif montaj yok">
            Size atanmış açık montaj bulunmuyor.
          </EmptyState>
        ) : (
          <ItemGroup className="gap-2">
            {nextAssignments.map((assignment) => (
              <AssignmentItem assignment={assignment} draftLabel="Taslak hazır" key={assignment.id} onOpen={() => onAssignmentOpen(assignment)} />
            ))}
          </ItemGroup>
        )}
      </FormSection>

      <FormSection title="Devam Eden Taslaklar">
        {nextDrafts.length === 0 ? (
          <EmptyState className="rounded-lg border border-dashed py-8" title="Taslak yok">
            Kaydedilmiş taslak rapor bulunmuyor.
          </EmptyState>
        ) : (
          <ItemGroup className="gap-2">
            {nextDrafts.map((report) => (
              <ListItem
                description={reportWorkItemsText(report)}
                key={report.id}
                meta={`Taslak · ${formatDateDisplay(report.report_date) || "-"}`}
                onClick={() => onDraftOpen(report)}
                title={report.company_name_snapshot ?? "Firma seçilmedi"}
              />
            ))}
          </ItemGroup>
        )}
      </FormSection>
    </>
  );
}

export function AssignmentCards({
  assignments,
  emptyText,
  onBack,
  onOpen
}: {
  assignments: InstallationAssignment[];
  emptyText: string;
  onBack: () => void;
  onOpen: (assignment: InstallationAssignment) => void;
}) {
  return (
    <>
      <BackButton onBack={onBack} />
      {assignments.length === 0 ? (
        <EmptyState className="rounded-lg border border-dashed py-8" title="Sırada iş yok">
          {emptyText}
        </EmptyState>
      ) : (
        <ItemGroup className="gap-2">
          {assignments.map((assignment) => (
            <AssignmentItem assignment={assignment} draftLabel="Taslak var" key={assignment.id} onOpen={() => onOpen(assignment)} />
          ))}
        </ItemGroup>
      )}
    </>
  );
}

export function ReportCards({
  emptyText,
  reports,
  onBack,
  onOpen
}: {
  emptyText: string;
  reports: ReportRow[];
  onBack: () => void;
  onOpen: (report: ReportRow) => void;
}) {
  return (
    <>
      <BackButton onBack={onBack} />
      {reports.length === 0 ? (
        <EmptyState className="rounded-lg border border-dashed py-8" title="Kayıt yok">
          {emptyText}
        </EmptyState>
      ) : (
        <ItemGroup className="gap-2">
          {reports.map((report) => (
            <ListItem
              description={report.status === "SUBMITTED" ? report.report_number ?? "Rapor" : "Taslak"}
              key={report.id}
              meta={formatDateDisplay(report.report_date) || "-"}
              onClick={() => onOpen(report)}
              title={report.company_name_snapshot ?? "Firma seçilmedi"}
            />
          ))}
        </ItemGroup>
      )}
    </>
  );
}
