const supportedLocales = [
  "ar",
  "bg-BG",
  "ca-ES",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "en-US",
  "es-ES",
  "et-EE",
  "fi-FI",
  "fr-FR",
  "hr-HR",
  "hu-HU",
  "is-IS",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "lt-LT",
  "lv-LV",
  "nl-NL",
  "no-NO",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sk-SK",
  "sl-SI",
  "sv-SE",
  "zh-CN",
  "zh-TW",
];

/**
 * This mapping provides a way to map a specific locale to another locale.
 *
 * This is usefull for countries with multiple valid locales but Adyen only supports a subset.
 *
 * This way it won't default to the "en-US" locale but instead use another locale for that country that Adyen does support.
 */
const localeToAdyenLocaleMapping: Record<string, string> = {
  "nb-NO": "no-NO",
};

export const convertToAdyenLocale = (locale: string): string => {
  // Normalize the input locale: replace "_" with "-" and convert to lowercase
  const normalizedLocale = locale.replace("_", "-").toLowerCase();

  // Check for an exact match (case-insensitive)
  const exactMatch = supportedLocales.find(
    (supportedLocale) => supportedLocale.toLowerCase() === normalizedLocale,
  );
  if (exactMatch) {
    return exactMatch;
  }

  // Search for a partial match (base locale, e.g., "es" -> "es-ES")
  const baseLocale = normalizedLocale.split("-")[0];
  const partialMatch = supportedLocales.find((supportedLocale) =>
    supportedLocale.toLowerCase().startsWith(baseLocale),
  );

  if (partialMatch) {
    return partialMatch;
  }

  // Try and map the incoming (CT) supported locale to the Adyen supported locale
  for (const [ctLocale, adyenLocale] of Object.entries(
    localeToAdyenLocaleMapping,
  ).values()) {
    if (ctLocale.toLowerCase() === normalizedLocale) {
      return adyenLocale;
    }
  }

  // Fallback to a default locale if no match is found
  return "en-US";
};
