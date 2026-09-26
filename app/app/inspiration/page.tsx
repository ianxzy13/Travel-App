import type { Metadata } from "next";
import { Images } from "lucide-react";
import { ComingSoon } from "@/components/app/coming-soon";

export const metadata: Metadata = { title: "Inspiration" };

export default function InspirationPage() {
  return (
    <ComingSoon
      title="Inspiration"
      description="Pinterest-style boards for your ideas."
      icon={Images}
      phase={7}
      features={[
        "Boards for dress, flowers, decor",
        "Upload images or paste links",
        "Discover wedding photos",
        "Colour palette extractor",
      ]}
    />
  );
}
