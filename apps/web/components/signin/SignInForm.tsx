import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authOptions } from "@/server/auth";
import { Info } from "lucide-react";

import serverConfig from "@karakeep/shared/config";

import CredentialsForm from "./CredentialsForm";
import OAuthAutoRedirect from "./OAuthAutoRedirect";
import SignInProviderButton from "./SignInProviderButton";

export default async function SignInForm() {
  const providers = authOptions.providers;
  let providerValues;
  if (providers) {
    providerValues = Object.values(providers).filter(
      // Credentials are handled manually by the sign in form
      (p) => p.id != "credentials",
    );
  }

  return (
    <div className="w-full">
      {/* Auto-redirect to OAuth provider if configured */}
      {providerValues && providerValues.length > 0 && (
        <OAuthAutoRedirect oauthProviderId={providerValues[0].id} />
      )}
      <Card className="w-full rounded-2xl border-border/70 bg-card/95 shadow-xl backdrop-blur">
        <CardHeader className="space-y-2 px-5 pb-3 pt-6 text-center sm:px-7 sm:pt-7">
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Welcome back
          </CardTitle>
          <CardDescription>Sign in to continue to Karakeep.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-5 pb-6 sm:px-7 sm:pb-7">
          {serverConfig.demoMode && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">Demo Mode</p>
                  <p>Email: {serverConfig.demoMode.email}</p>
                  <p>Password: {serverConfig.demoMode.password}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <CredentialsForm />

          {providerValues && providerValues.length > 0 && (
            <>
              <div className="flex w-full items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="bg-card px-1 text-xs font-medium text-muted-foreground">
                  Or continue with
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
              <div className="space-y-2">
                {providerValues.map((provider) => (
                  <SignInProviderButton
                    key={provider.id}
                    provider={{ id: provider.id, name: provider.name }}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
