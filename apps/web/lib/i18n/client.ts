"use client";

import i18next from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import {
  initReactI18next,
  Trans as TransOrg,
  useTranslation as useTranslationOrg,
} from "react-i18next";

import { getOptions, languages } from "./settings";

const runsOnServerSide = typeof window === "undefined";

i18next
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`./locales/${language}/${namespace}.json`),
    ),
  )
  .init({
    ...getOptions(),
    lng: undefined, // let detect the language on client side
    debug: false,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    preload: runsOnServerSide ? languages : [],
  });

export function useTranslation(): ReturnType<
  typeof useTranslationOrg<"translation">
>;
export function useTranslation(ns: "translation"): ReturnType<
  typeof useTranslationOrg<"translation">
>;
export function useTranslation(ns: "profile_menu"): ReturnType<
  typeof useTranslationOrg<"profile_menu">
>;
export function useTranslation(ns: "translation" | "profile_menu" = "translation") {
  return useTranslationOrg(ns);
}

export const Trans = TransOrg;
export const i18n = i18next;
