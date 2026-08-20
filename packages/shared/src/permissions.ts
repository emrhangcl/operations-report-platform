import type { ReportStatus, UserRole } from "@tunca/types";

export interface PermissionProfile {
  id: string;
  role: UserRole;
  is_active: boolean;
}

export interface PermissionReport {
  created_by_user_id: string;
  status: ReportStatus;
}

export function canReadReport(profile: PermissionProfile, report: PermissionReport) {
  if (!profile.is_active) return false;
  return profile.role === "ADMIN" || report.created_by_user_id === profile.id;
}

export function canUpdateReport(profile: PermissionProfile, report: PermissionReport) {
  if (!profile.is_active) return false;
  if (profile.role === "ADMIN") return true;
  return report.created_by_user_id === profile.id && report.status === "DRAFT";
}

export function shouldUseExistingReportByClientRequestId(
  existingClientRequestId: string | null,
  incomingClientRequestId: string
) {
  return existingClientRequestId === incomingClientRequestId;
}
