import { NextRequest, NextResponse } from "next/server";
import { generateIcs } from "@/lib/trip/calendar";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const title = p.get("title");
  const date = p.get("date");
  if (!title || !date) {
    return NextResponse.json({ error: "title and date required" }, { status: 400 });
  }

  const ics = generateIcs({
    title,
    date,
    startTime: p.get("start"),
    endTime: p.get("end"),
    timeZone: p.get("tz"),
    location: p.get("location"),
    description: p.get("desc"),
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${title.replace(/[^a-zA-Z0-9 ]/g, "")}.ics"`,
    },
  });
}
