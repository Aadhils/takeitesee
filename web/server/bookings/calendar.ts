import type { ProductionBooking } from '../../types/production-domain';

function parseLocalParts(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(timeValue);
  if (!dateMatch || !timeMatch) throw new Error('Booking date or time is invalid.');
  return {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? '0'),
  };
}

function zonedParts(timestamp: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return {
    year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second),
  };
}

function localBookingTimeToUtc(dateValue: string, timeValue: string, timeZone: string) {
  const desired = parseLocalParts(dateValue, timeValue);
  const desiredAsUtc = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
  let candidate = desiredAsUtc;

  for (let index = 0; index < 3; index += 1) {
    const shown = zonedParts(candidate, timeZone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    candidate = desiredAsUtc - (shownAsUtc - candidate);
  }

  const check = zonedParts(candidate, timeZone);
  if (check.year !== desired.year || check.month !== desired.month || check.day !== desired.day || check.hour !== desired.hour || check.minute !== desired.minute) {
    throw new Error('Booking time cannot be represented in its configured timezone.');
  }
  return new Date(candidate);
}

function toIcsUtc(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldIcsLine(line: string) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (chunk && chunkBytes + bytes > 73) {
      chunks.push(chunk);
      chunk = ` ${character}`;
      chunkBytes = 1 + bytes;
    } else {
      chunk += character;
      chunkBytes += bytes;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.join('\r\n');
}

function calendarStatus(status: ProductionBooking['status']) {
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'pending' || status === 'rescheduled') return 'TENTATIVE';
  return 'CONFIRMED';
}

export function buildBookingCalendar(booking: ProductionBooking) {
  const start = localBookingTimeToUtc(booking.booking_date, booking.start_time, booking.timezone);
  const end = new Date(start.getTime() + booking.duration_minutes * 60_000);
  const provider = booking.provider_name || (booking.provider.provider_type === 'business' ? 'Business provider' : 'Professional provider');
  const summary = `${booking.service_name} with ${provider}`;
  const description = `TakeItEsee booking ${booking.booking_reference}. Status: ${booking.status}. Manage: https://www.takeitesee.com/bookings/${encodeURIComponent(booking.id)}`;
  const uid = `${booking.id}@takeitesee.com`;
  const stampSource = booking.updated_at instanceof Date ? booking.updated_at : new Date(booking.updated_at);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TakeItEsee//Booking Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(uid)}`,
    `DTSTAMP:${toIcsUtc(stampSource)}`,
    `LAST-MODIFIED:${toIcsUtc(stampSource)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(booking.location || 'TakeItEsee service location')}`,
    `STATUS:${calendarStatus(booking.status)}`,
    'TRANSP:OPAQUE',
    `URL:https://www.takeitesee.com/bookings/${encodeURIComponent(booking.id)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

export function bookingCalendarFilename(reference: string) {
  const safeReference = reference.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'booking';
  return `takeitesee-${safeReference}.ics`;
}
