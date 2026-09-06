import type { BillingInterval, OrganizationStatus, SubscriptionStatus } from "@operations/types";

export interface PlatformMetrics {
  total_organizations: number;
  active_subscriptions: number;
  monthly_subscriptions: number;
  yearly_subscriptions: number;
  lifetime_subscriptions: number;
  pending_payments: number;
  failed_renewals: number;
  canceled_subscriptions: number;
  grace_period_accounts: number;
  read_only_accounts: number;
  mrr_minor: number;
  arr_minor: number;
  successful_collected_minor: number;
  refunded_total_minor: number;
  new_organizations_30d: number;
  active_users: number;
  payment_error_count: number;
  last_successful_backup_at: string | null;
  plan_distribution: Array<{ plan_name: string; organization_count: number }>;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  monthly_price_minor: number | null;
  yearly_price_minor: number | null;
  is_active: boolean;
  is_public: boolean;
}

export interface OrganizationSubscription {
  id?: string;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  plan_id: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  grace_period_ends_at: string | null;
  is_current: boolean;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  billing_email: string | null;
  created_at: string;
  closed_at: string | null;
  subscription: OrganizationSubscription | null;
}

export interface PaymentEvent {
  id: string;
  organizationId: string | null;
  provider: string;
  eventType: string;
  signatureVerified: boolean;
  processedAt: string | null;
  receivedAt: string;
  hasError: boolean;
}

export interface GlobalAuditLog {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  action: string;
  entityTable: string;
  entityId: string | null;
  createdAt: string;
}

export interface DashboardPayload {
  metrics: PlatformMetrics;
  plans: Plan[];
  organizations: OrganizationRow[];
  paymentEvents: PaymentEvent[];
  auditLogs: GlobalAuditLog[];
}

export interface OrganizationMember {
  profile_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
  } | null;
}

export interface OrganizationPayment {
  id: string;
  provider: string;
  status: string;
  amount_minor: number;
  refunded_amount_minor: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
}

export interface OrganizationSubscriptionHistory extends OrganizationSubscription {
  id: string;
  provider: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ExportRequest {
  id: string;
  organization_id: string;
  scope: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
}

export interface OrganizationDetail {
  organization: OrganizationRow & {
    legal_name: string | null;
    tax_identifier: string | null;
    timezone: string;
    updated_at: string;
    logo_url: string | null;
  };
  members: OrganizationMember[];
  subscriptions: OrganizationSubscriptionHistory[];
  payments: OrganizationPayment[];
  auditLogs: OrganizationAuditLog[];
  exportRequests: ExportRequest[];
}

export type OrganizationAction =
  | { action: "suspend" | "activate" | "start_closure" | "grant_lifetime"; planId?: null; billingInterval?: null }
  | { action: "remove_lifetime" | "change_plan"; planId: string; billingInterval: "monthly" | "yearly" };

export const emptyMetrics: PlatformMetrics = {
  total_organizations: 0,
  active_subscriptions: 0,
  monthly_subscriptions: 0,
  yearly_subscriptions: 0,
  lifetime_subscriptions: 0,
  pending_payments: 0,
  failed_renewals: 0,
  canceled_subscriptions: 0,
  grace_period_accounts: 0,
  read_only_accounts: 0,
  mrr_minor: 0,
  arr_minor: 0,
  successful_collected_minor: 0,
  refunded_total_minor: 0,
  new_organizations_30d: 0,
  active_users: 0,
  payment_error_count: 0,
  last_successful_backup_at: null,
  plan_distribution: []
};

export const emptyDashboard: DashboardPayload = {
  metrics: emptyMetrics,
  plans: [],
  organizations: [],
  paymentEvents: [],
  auditLogs: []
};
