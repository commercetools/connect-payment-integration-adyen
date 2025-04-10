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

export const convertToAdyenLocale = (locale: string): string => {
  // Normalize the input locale: replace "_" with "-" and convert to lowercase
  const normalizedLocale = locale.replace("_", "-").toLowerCase();

  // Check for an exact match (case-insensitive)
  const exactMatch = supportedLocales.find((supportedLocale) => supportedLocale.toLowerCase() === normalizedLocale);
  if (exactMatch) {
    return exactMatch;
  }

  // Search for a partial match (base locale, e.g., "es" -> "es-ES")
  const baseLocale = normalizedLocale.split("-")[0];
  const partialMatch = supportedLocales.find((supportedLocale) => supportedLocale.toLowerCase().startsWith(baseLocale));

  if (partialMatch) {
    return partialMatch;
  }

  // Fallback to a default locale if no match is found
  return "en-US";
};
