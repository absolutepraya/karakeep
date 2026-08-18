import type { Metadata } from "next";
import ApiKeySettings from "@/components/settings/ApiKeySettings";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { useTranslation } from "@/lib/i18n/server";
import { getServerAuthSession } from "@/server/auth";
import { KeyRound } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return {
    title: `${t("settings.api_keys.api_keys")} | Marka`,
  };
}

export default async function ApiKeysPage() {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  const session = await getServerAuthSession();
  const isAdmin = session?.user.role === "admin";
  return (
    <SettingsPage
      title={t("settings.api_keys.api_keys")}
      description="Create, scope, rotate, and revoke keys for scripts, agents, and external integrations."
      icon={<KeyRound className="size-6 shrink-0 text-muted-foreground" />}
    >
      <ApiKeySettings isAdmin={isAdmin} />
    </SettingsPage>
  );
}
