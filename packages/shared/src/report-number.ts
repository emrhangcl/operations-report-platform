export function formatReportNumber(year: number, sequence: number) {
  return `TNC-${year}-${sequence.toString().padStart(6, "0")}`;
}
