export function formatReportNumber(year: number, sequence: number) {
  return `RPR-${year}-${sequence.toString().padStart(6, "0")}`;
}
