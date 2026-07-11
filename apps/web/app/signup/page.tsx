import { redirect } from "next/dist/client/components/navigation";
import KarakeepLogo from "@/components/KarakeepIcon";
import SignUpForm from "@/components/signup/SignUpForm";
import { getServerAuthSession } from "@/server/auth";

import {
  isMobileAppRedirect,
  validateRedirectUrl,
} from "@karakeep/shared/utils/redirectUrl";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectUrl?: string; skipSessionRedirect?: string }>;
}) {
  const session = await getServerAuthSession();
  const { redirectUrl: rawRedirectUrl, skipSessionRedirect } =
    await searchParams;
  const redirectUrl = validateRedirectUrl(rawRedirectUrl) ?? "/";
  const shouldSkipSessionRedirect =
    isMobileAppRedirect(redirectUrl) && skipSessionRedirect === "1";

  if (session && !shouldSkipSessionRedirect) {
    redirect(redirectUrl);
  }

  return (
    <div className="bg-linear-to-b from-sidebar/70 relative flex min-h-svh items-center justify-center overflow-hidden via-background to-background px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="bg-radial from-primary/12 pointer-events-none absolute inset-x-0 top-0 h-80 to-transparent blur-3xl"
      />
      <div className="relative w-full max-w-md space-y-6">
        <div className="flex items-center justify-center">
          <KarakeepLogo height={72} />
        </div>
        <SignUpForm redirectUrl={redirectUrl} />
      </div>
    </div>
  );
}
