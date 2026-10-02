import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BedDouble, Printer } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Rooming List", robots: { index: false } };
}

export default async function PrintRoomsPage() {
  const { wedding } = await requireWedding();
  const sb = await createClient();
  const t = await getTranslations("hotels");

  const [hotels, roomTypes, rooms, assignments, guests] = await Promise.all([
    fetchAll((f, to) =>
      sb.from("hotels").select("id, name").eq("wedding_id", wedding.id).order("created_at").range(f, to),
    ),
    fetchAll((f, to) =>
      sb.from("hotel_room_types").select("id, name, max_guests, beds").eq("wedding_id", wedding.id).range(f, to),
    ),
    fetchAll((f, to) =>
      sb.from("hotel_rooms").select("id, hotel_id, room_type_id, room_number, floor").eq("wedding_id", wedding.id).order("sort_order").range(f, to),
    ),
    fetchAll((f, to) =>
      sb.from("hotel_room_assignments").select("room_id, guest_id, check_in, check_out, needs_crib").eq("wedding_id", wedding.id).range(f, to),
    ),
    fetchAll((f, to) =>
      sb.from("guests").select("id, first_name, last_name, age_group").eq("wedding_id", wedding.id).range(f, to),
    ),
  ]);

  const typeName = new Map(roomTypes.map((rt) => [rt.id, rt.name]));
  const typeMax = new Map(roomTypes.map((rt) => [rt.id, rt.max_guests]));
  const guestName = new Map(guests.map((g) => [g.id, `${g.first_name} ${g.last_name}`.trim()]));

  const assignmentsByRoom = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = assignmentsByRoom.get(a.room_id) ?? [];
    list.push(a);
    assignmentsByRoom.set(a.room_id, list);
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-3 p-4 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/hotels/rooms">
            <ArrowLeft className="mr-1 size-4" />
            {t("export.back")}
          </Link>
        </Button>
        <Button size="sm" onClick={() => {}} className="ml-auto" id="print-btn">
          <Printer className="mr-1 size-4" />
          {t("export.print")}
        </Button>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.getElementById("print-btn")?.addEventListener("click",()=>window.print())`,
          }}
        />
      </div>

      <div className="mx-auto max-w-4xl space-y-8 p-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BedDouble className="size-6" />
          {t("export.roomingList")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {wedding.partner_a_name} & {wedding.partner_b_name}
          {wedding.wedding_date ? ` · ${wedding.wedding_date}` : ""}
        </p>

        {hotels.map((hotel) => {
          const hotelRooms = rooms.filter((r) => r.hotel_id === hotel.id);
          if (hotelRooms.length === 0) return null;
          return (
            <section key={hotel.id} className="break-inside-avoid">
              <h2 className="border-b pb-1 text-lg font-semibold">{hotel.name}</h2>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1.5 pr-3 font-medium">{t("export.room")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("export.type")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("export.floor")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("export.guest")}</th>
                    <th className="py-1.5 pr-3 font-medium">{t("export.checkIn")}</th>
                    <th className="py-1.5 font-medium">{t("export.checkOut")}</th>
                  </tr>
                </thead>
                <tbody>
                  {hotelRooms.map((room) => {
                    const ra = assignmentsByRoom.get(room.id) ?? [];
                    const tName = room.room_type_id ? (typeName.get(room.room_type_id) ?? "") : "";
                    if (ra.length === 0) {
                      return (
                        <tr key={room.id} className="border-b">
                          <td className="py-1.5 pr-3 font-mono">{room.room_number}</td>
                          <td className="py-1.5 pr-3">{tName}</td>
                          <td className="py-1.5 pr-3">{room.floor ?? ""}</td>
                          <td className="text-muted-foreground py-1.5 pr-3 italic">
                            {t("export.empty")}
                          </td>
                          <td className="py-1.5 pr-3" />
                          <td className="py-1.5" />
                        </tr>
                      );
                    }
                    return ra.map((a, i) => (
                      <tr key={a.guest_id} className={i === ra.length - 1 ? "border-b" : ""}>
                        <td className="py-1.5 pr-3 font-mono">{i === 0 ? room.room_number : ""}</td>
                        <td className="py-1.5 pr-3">{i === 0 ? tName : ""}</td>
                        <td className="py-1.5 pr-3">{i === 0 ? (room.floor ?? "") : ""}</td>
                        <td className="py-1.5 pr-3">
                          {guestName.get(a.guest_id) ?? ""}
                          {a.needs_crib ? " (crib)" : ""}
                        </td>
                        <td className="py-1.5 pr-3">{a.check_in ?? ""}</td>
                        <td className="py-1.5">{a.check_out ?? ""}</td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
