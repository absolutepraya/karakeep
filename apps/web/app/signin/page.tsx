import { redirect } from "next/dist/client/components/navigation";
import MarkaLogo from "@/components/MarkaLogo";
import SignInForm from "@/components/signin/SignInForm";
import { getServerAuthSession } from "@/server/auth";

export default async function SignInPage() {
  const session = await getServerAuthSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="bg-linear-to-b from-sidebar/70 relative flex min-h-svh items-center justify-center overflow-hidden via-background to-background px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="bg-radial from-primary/12 pointer-events-none absolute inset-x-0 top-0 h-80 to-transparent blur-3xl"
      />
      <div className="relative w-full max-w-md space-y-6">
        <div className="flex items-center justify-center">
          <MarkaLogo height={72} />
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
