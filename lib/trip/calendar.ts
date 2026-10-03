type CalendarEvent = {
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  timeZone?: string | null;
  location?: string | null;
  description?: string | null;
};

function icsDate(date: string, time: string | null | undefined, tz: string | null | undefined): string {
  const d = date.replace(/-/g, "");
  if (!time) return d;
  const t = time.slice(0, 5).replace(":", "") + "00";
  if (tz) return `TZID=${tz}:${d}T${t}`;
  return `${d}T${t}00`;
}

function addDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function fold(line: string): string {
  const lines: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    lines.push(remaining.slice(0, 75));
    remaining = " " + remaining.slice(75);
  }
  lines.push(remaining);
  return lines.join("\r\n");
}

export function generateIcs(event: CalendarEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vow//Wedding//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
  ];

  const uid = `${event.date}-${event.title.replace(/\s/g, "-").toLowerCase()}@vow.app`;
  lines.push(fold(`UID:${uid}`));
  lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`);

  if (event.startTime) {
    const dtstart = icsDate(event.date, event.startTime, event.timeZone);
    lines.push(fold(dtstart.includes("TZID") ? `DTSTART;${dtstart}` : `DTSTART:${dtstart}`));
    if (event.endTime) {
      const dtend = icsDate(event.date, event.endTime, event.timeZone);
      lines.push(fold(dtend.includes("TZID") ? `DTEND;${dtend}` : `DTEND:${dtend}`));
    }
  } else {
    lines.push(`DTSTART;VALUE=DATE:${event.date.replace(/-/g, "")}`);
    lines.push(`DTEND;VALUE=DATE:${addDay(event.date)}`);
  }

  lines.push(fold(`SUMMARY:${escapeIcs(event.title)}`));
  if (event.location) lines.push(fold(`LOCATION:${escapeIcs(event.location)}`));
  if (event.description) lines.push(fold(`DESCRIPTION:${escapeIcs(event.description)}`));

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const base = "https://www.google.com/calendar/render?action=TEMPLATE";
  const params = new URLSearchParams();
  params.set("text", event.title);

  if (event.startTime) {
    const start = `${event.date.replace(/-/g, "")}T${event.startTime.slice(0, 5).replace(":", "")}00`;
    const end = event.endTime
      ? `${event.date.replace(/-/g, "")}T${event.endTime.slice(0, 5).replace(":", "")}00`
      : start;
    params.set("dates", `${start}/${end}`);
  } else {
    const d = event.date.replace(/-/g, "");
    params.set("dates", `${d}/${addDay(event.date)}`);
  }

  if (event.timeZone) params.set("ctz", event.timeZone);
  if (event.location) params.set("location", event.location);
  if (event.description) params.set("details", event.description);

  return `${base}&${params.toString()}`;
}
