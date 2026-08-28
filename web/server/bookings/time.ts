export function timeToMinutes(value: string) {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) throw new Error('Booking time is invalid.');

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  const meridiem = match[4];

  if (minute > 59 || second > 59) throw new Error('Booking time is invalid.');

  if (meridiem) {
    if (hour < 1 || hour > 12) throw new Error('Booking time is invalid.');
    if (hour === 12) hour = 0;
    if (meridiem === 'PM') hour += 12;
  } else if (hour > 23) {
    throw new Error('Booking time is invalid.');
  }

  return hour * 60 + minute;
}

export function normalizeBookingTime(value: string) {
  const total = timeToMinutes(value);
  const hour = String(Math.floor(total / 60)).padStart(2, '0');
  const minute = String(total % 60).padStart(2, '0');
  return `${hour}:${minute}`;
}

function timezoneOffsetSuffix(timezone: string) {
  if (timezone === 'Asia/Kolkata') return '+05:30';
  if (timezone === 'UTC' || timezone === 'Etc/UTC') return 'Z';
  throw new Error(`Unsupported booking timezone: ${timezone}`);
}

export function localDateTimeToInstantIso(value: string, timezone: string) {
  const trimmed = value.trim();
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const instant = new Date(trimmed);
    if (Number.isNaN(instant.getTime())) throw new Error('Blackout period is invalid.');
    return instant.toISOString();
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error('Blackout period is invalid.');
  const [, date, hour, minute, second = '00'] = match;
  const instant = new Date(`${date}T${hour}:${minute}:${second}${timezoneOffsetSuffix(timezone)}`);
  if (Number.isNaN(instant.getTime())) throw new Error('Blackout period is invalid.');
  return instant.toISOString();
}

export function bookingInstantIso(date: string, totalMinutes: number, timezone: string) {
  const dayOffset = Math.floor(totalMinutes / 1440);
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minute = String(normalized % 60).padStart(2, '0');
  const base = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) throw new Error('Booking date is invalid.');
  base.setUTCDate(base.getUTCDate() + dayOffset);
  return new Date(`${base.toISOString().slice(0, 10)}T${hour}:${minute}:00${timezoneOffsetSuffix(timezone)}`).toISOString();
}
