"use client";

import { useEffect, useRef } from "react";
import { saveTimeZone } from "@/app/app/settings/actions";

export function TimezoneSync() {
  const saved = useRef(false);
  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) saveTimeZone(tz);
  }, []);
  return null;
}
