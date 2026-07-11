"use client";

import { useEffect, useState } from "react";
import { formatLocalDate } from "@/lib/date-format";
import { useTranslation } from "@/lib/i18n/client";

/**
 * Renders a date formatted in Asia/Jakarta on the client to avoid
 * server-rendered timezone differences and hydration mismatches.
 */
export default function FormattedDate({
  date,
  formatStr = "PP, p",
}: {
  date: Date | null | undefined;
  formatStr?: string;
}) {
  const { i18n } = useTranslation();
  const [formatted, setFormatted] = useState("");

  useEffect(() => {
    setFormatted(date ? formatLocalDate(date, formatStr, i18n.language) : "");
  }, [date, formatStr, i18n.language]);

  return <>{formatted}</>;
}
