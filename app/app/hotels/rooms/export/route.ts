import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { roomTitle } from "@/lib/hotels/room-sharing";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { requireWedding } from "@/lib/wedding";
import { xlsxResponse } from "@/lib/xlsx/build";

/** GET /app/hotels/rooms/export → who sleeps in which room, as an Excel file. */
export async function GET() {
  const { wedding } = await requireWedding();
  const sb = await createClient();
  const t = await getTranslations("hotels");
  const gt = await getTranslations("guests");

  const [hotels, roomTypes, rooms, assignments, guests] = await Promise.all([
    fetchAll((f, to) =>
      sb.from("hotels").select("id, name").eq("wedding_id", wedding.id).range(f, to),
    ),
    fetchAll((f, to) =>
      sb.from("hotel_room_types").select("id, name").eq("wedding_id", wedding.id).range(f, to),
    ),
    fetchAll((f, to) =>
      sb
        .from("hotel_rooms")
        .select("id, hotel_id, room_type_id, room_number, name, floor")
        .eq("wedding_id", wedding.id)
        .order("sort_order")
        .range(f, to),
    ),
    fetchAll((f, to) =>
      sb
        .from("hotel_room_assignments")
        .select("room_id, guest_id, check_in, check_out, needs_crib")
        .eq("wedding_id", wedding.id)
        .range(f, to),
    ),
    fetchAll((f, to) =>
      sb
        .from("guests")
        .select("id, first_name, last_name, age_group")
        .eq("wedding_id", wedding.id)
        .range(f, to),
    ),
  ]);

  const hotelName = new Map(hotels.map((h) => [h.id, h.name]));
  const typeName = new Map(roomTypes.map((rt) => [rt.id, rt.name]));
  const guestName = new Map(guests.map((g) => [g.id, `${g.first_name} ${g.last_name}`.trim()]));
  const guestAge = new Map(guests.map((x) => [x.id, x.age_group]));
  const ageLabel = (age: string | undefined) =>
    age === "adult" || age === "child" || age === "infant" ? gt(`ageGroups.${age}`) : "";

  const assignmentsByRoom = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const list = assignmentsByRoom.get(a.room_id) ?? [];
    list.push(a);
    assignmentsByRoom.set(a.room_id, list);
  }

  const rows = rooms.flatMap((room) => {
    const roomAssignments = assignmentsByRoom.get(room.id) ?? [];
    if (roomAssignments.length === 0) {
      return [
        {
          [t("export.hotel")]: hotelName.get(room.hotel_id) ?? "",
          [t("export.room")]: roomTitle(room),
          [t("export.type")]: room.room_type_id ? (typeName.get(room.room_type_id) ?? "") : "",
          [t("export.floor")]: room.floor ?? "",
          [t("export.guest")]: "",
          [t("export.ageGroup")]: "",
          [t("export.checkIn")]: "",
          [t("export.checkOut")]: "",
          [t("export.crib")]: "",
        },
      ];
    }
    return roomAssignments.map((a) => ({
      [t("export.hotel")]: hotelName.get(room.hotel_id) ?? "",
      [t("export.room")]: roomTitle(room),
      [t("export.type")]: room.room_type_id ? (typeName.get(room.room_type_id) ?? "") : "",
      [t("export.floor")]: room.floor ?? "",
      [t("export.guest")]: guestName.get(a.guest_id) ?? "",
      [t("export.ageGroup")]: ageLabel(guestAge.get(a.guest_id)),
      [t("export.checkIn")]: a.check_in ?? "",
      [t("export.checkOut")]: a.check_out ?? "",
      [t("export.crib")]: a.needs_crib ? t("export.yes") : "",
    }));
  });

  const header = [
    t("export.hotel"),
    t("export.room"),
    t("export.type"),
    t("export.floor"),
    t("export.guest"),
    t("export.ageGroup"),
    t("export.checkIn"),
    t("export.checkOut"),
    t("export.crib"),
  ];
  const slug = `${wedding.partner_a_name}-${wedding.partner_b_name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return xlsxResponse(
    `rooms-${slug || "wedding"}-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    t("title"),
    [
      header,
      ...rows.map((r) => header.map((h) => String((r as Record<string, unknown>)[h] ?? ""))),
    ],
  );
}
