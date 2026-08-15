import "i18next";

import collaboration from "../lib/i18n/locales/en/collaboration.json";
import translation from "../lib/i18n/locales/en/translation.json";

declare module "i18next" {
  // Extend CustomTypeOptions
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      collaboration: typeof collaboration;
      translation: typeof translation;
    };
  }
}
