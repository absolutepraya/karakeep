import { getUserLocalSettings } from "@/lib/userLocalSettings/userLocalSettings";
import { createInstance, FlatNamespace, KeyPrefix } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { FallbackNs } from "react-i18next";
import { initReactI18next } from "react-i18next/initReactI18next";

import { getOptions } from "./settings";

const initI18next = async (lng: string, ns: string | string[]) => {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          import(`./locales/${language}/${namespace}.json`),
      ),
    )
    .init(getOptions(lng, ns?.toString()));
  return i18nInstance;
};

export async function useTranslation<
  Ns extends FlatNamespace = "translation",
  KPrefix extends KeyPrefix<FallbackNs<Ns>> = undefined,
>(ns?: Ns, options: { keyPrefix?: KPrefix } = {}) {
  const lng = (await getUserLocalSettings()).lang;
  const resolvedNs = (ns ?? "translation") as Ns;
  const i18nextInstance = await initI18next(lng, resolvedNs);
  return {
    t: i18nextInstance.getFixedT<Ns, KPrefix>(
      lng,
      resolvedNs,
      options.keyPrefix,
    ),
    i18n: i18nextInstance,
  };
}
