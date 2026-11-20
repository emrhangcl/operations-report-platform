// Owner panelindeki "Tahsilat / Yeni firma" grafiginin gunluk serisi. Toplama sunucuda yapilir;
// istemciye yalnizca gunluk toplamlar gider. Gunler Europe/Istanbul takvimine gore sayilir.

export interface DailyActivity {
  date: string; // YYYY-MM-DD, Europe/Istanbul
  collectedMinor: number;
  newOrganizations: number;
}

interface ActivityPayment {
  amount_minor: number;
  refunded_amount_minor: number;
  paid_at: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const istanbulDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function dayKey(value: Date) {
  return istanbulDay.format(value);
}

export function buildDailyActivity(input: {
  payments: ActivityPayment[];
  organizations: Array<{ created_at: string }>;
  days: number;
  now: Date;
}): DailyActivity[] {
  const series: DailyActivity[] = [];
  const byDate = new Map<string, DailyActivity>();
  for (let offset = input.days - 1; offset >= 0; offset -= 1) {
    const date = dayKey(new Date(input.now.getTime() - offset * DAY_MS));
    if (byDate.has(date)) continue;
    const day = { date, collectedMinor: 0, newOrganizations: 0 };
    byDate.set(date, day);
    series.push(day);
  }

  for (const payment of input.payments) {
    if (!payment.paid_at) continue;
    const day = byDate.get(dayKey(new Date(payment.paid_at)));
    if (day) day.collectedMinor += payment.amount_minor - payment.refunded_amount_minor;
  }

  for (const organization of input.organizations) {
    const day = byDate.get(dayKey(new Date(organization.created_at)));
    if (day) day.newOrganizations += 1;
  }

  return series;
}

export function periodChange(
  series: DailyActivity[],
  key: "collectedMinor" | "newOrganizations",
  days: number
): { current: number; previous: number; percent: number | null } {
  const sum = (items: DailyActivity[]) => items.reduce((total, item) => total + item[key], 0);
  const current = sum(series.slice(-days));
  const previousItems = series.slice(-2 * days, -days);
  const previous = sum(previousItems);
  if (previousItems.length < days || previous === 0) return { current, previous, percent: null };
  return { current, previous, percent: Math.round(((current - previous) / previous) * 1000) / 10 };
}
