import { redirect } from "next/dist/client/components/navigation";
import Image from "next/image";
import MarkaLogo from "@/components/MarkaLogo";
import SignInForm from "@/components/signin/SignInForm";
import { MARKA } from "@/lib/brand";
import { useTranslation } from "@/lib/i18n/server";
import { getServerAuthSession } from "@/server/auth";

export default async function SignInPage() {
  const session = await getServerAuthSession();
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  if (session) {
    redirect("/");
  }

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          viewBox="0 0 800 900"
        >
          <path
            d="M-40 130H840M-40 290H840M-40 450H840M-40 610H840M-40 770H840"
            stroke="currentColor"
          />
          <path
            d="M120 -40V940M280 -40V940M440 -40V940M600 -40V940M760 -40V940"
            stroke="currentColor"
          />
          <circle
            cx="600"
            cy="210"
            r="142"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="600"
            cy="210"
            r="88"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="600"
            cy="210"
            r="34"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M458 210H742M600 68V352"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>

        <div className="relative flex items-center">
          <Image
            src={MARKA.wordmark.white}
            alt={MARKA.name}
            width={510}
            height={135}
            priority
            style={{ height: 42, width: "auto" }}
            className="dark:hidden"
          />
          <Image
            src={MARKA.wordmark.navy}
            alt=""
            width={510}
            height={135}
            priority
            style={{ height: 42, width: "auto" }}
            className="hidden dark:block"
          />
        </div>

        <div className="relative max-w-lg pb-4 xl:pb-8">
          <p className="mb-5 text-sm font-medium text-primary-foreground/65">
            {t("signin.eyebrow")}
          </p>
          <h1 className="max-w-md text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
            {t("signin.title")}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-primary-foreground/70">
            {t("signin.description")}
          </p>
        </div>

        <p className="relative text-xs text-primary-foreground/45">
          {t("signin.footer")}
        </p>
      </section>

      <section className="flex min-h-svh flex-col items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center lg:hidden">
            <MarkaLogo height={44} />
          </div>
          <SignInForm />
          <p className="text-center text-xs text-muted-foreground">
            {t("signin.privacy_note")}
          </p>
        </div>
      </section>
    </main>
  );
}
