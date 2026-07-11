import { format } from "date-fns";

const JAKARTA_TIME_ZONE = "Asia/Jakarta";
const jakartaDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: JAKARTA_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

function toJakartaWallTime(date: Date) {
  const parts = new Map(
    jakartaDateTimeFormatter
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );

  return new Date(
    Number(parts.get("year")),
    Number(parts.get("month")) - 1,
    Number(parts.get("day")),
    Number(parts.get("hour")),
    Number(parts.get("minute")),
    Number(parts.get("second")),
    date.getMilliseconds(),
  );
}

export function normalizeI18nLanguage(language: string | undefined) {
  if (!language) {
    return undefined;
  }

  if (language === "zhtw") {
    return "zh-TW";
  }

  return language.replace("_", "-");
}

export function formatLocalDate(
  date: Date,
  formatStr: string,
  language?: string,
) {
  const locale = normalizeI18nLanguage(language);

  const formatWithIntl = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: JAKARTA_TIME_ZONE,
      }).format(date);
    } catch (error) {
      if (error instanceof RangeError) {
        return new Intl.DateTimeFormat(undefined, {
          ...options,
          timeZone: JAKARTA_TIME_ZONE,
        }).format(date);
      }

      throw error;
    }
  };

  if (formatStr === "PP, p") {
    return formatWithIntl({
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  if (formatStr === "PPP") {
    return formatWithIntl({
      dateStyle: "long",
    });
  }

  return format(toJakartaWallTime(date), formatStr);
}
