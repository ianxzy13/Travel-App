import { v } from "@/lib/i18n/validation";
import { z } from "zod";

export const playlistSongSchema = z.object({
  title: z.string().trim().min(1, v("songTitle")).max(200, v("tooLong", 200)),
  artist: z.string().trim().max(200, v("tooLong", 200)),
  categoryId: z.uuid(v("category")),
  priority: z.enum(["must", "nice", "no"]),
});
export type PlaylistSongValues = z.infer<typeof playlistSongSchema>;

export const playlistCategorySchema = z.object({
  name: z.string().trim().min(1, v("name")).max(60, v("tooLong", 60)),
});
