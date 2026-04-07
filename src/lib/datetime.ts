const IST_TIME_ZONE = "Asia/Kolkata";
const IST_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

function toValidDate(value?: string | number | Date): Date {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) return new Date();
  return date;
}

export function formatIstTime(value?: string | number | Date): string {
  return IST_TIME_FORMATTER.format(toValidDate(value));
}

export function formatIstDateTime(value?: string | number | Date): string {
  return IST_DATE_TIME_FORMATTER.format(toValidDate(value));
}
