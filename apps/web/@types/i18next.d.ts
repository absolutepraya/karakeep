import "i18next";

import profileMenu from "../lib/i18n/locales/en/profile_menu.json";
import translation from "../lib/i18n/locales/en/translation.json";

declare module "i18next" {
  // Extend CustomTypeOptions
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      profile_menu: typeof profileMenu;
      translation: typeof translation;
    };
  }
}
