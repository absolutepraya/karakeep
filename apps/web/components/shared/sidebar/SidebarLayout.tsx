import { Suspense } from "react";
import ErrorFallback from "@/components/dashboard/ErrorFallback";
import Header from "@/components/dashboard/header/Header";
import DemoModeBanner from "@/components/DemoModeBanner";
import LoadingSpinner from "@/components/ui/spinner";
import ValidAccountCheck from "@/components/utils/ValidAccountCheck";
import { ErrorBoundary } from "react-error-boundary";

import serverConfig from "@karakeep/shared/config";

export default function SidebarLayout({
  children,
  mobileSidebar,
  sidebar,
  modal,
}: {
  children: React.ReactNode;
  mobileSidebar: React.ReactNode;
  sidebar: React.ReactNode;
  modal?: React.ReactNode;
}) {
  return (
    <div className="sm:fixed sm:inset-0 sm:overflow-hidden">
      <Header />
      <div className="flex min-h-[calc(100vh-64px)] w-full flex-col sm:h-[calc(100dvh-64px)] sm:flex-row sm:overflow-hidden">
        <ValidAccountCheck />
        <div className="hidden flex-none sm:flex">{sidebar}</div>
        <main className="flex-1 bg-background sm:min-h-0 sm:overflow-y-auto sm:rounded-tl-lg sm:border-l sm:border-t">
          {serverConfig.demoMode && <DemoModeBanner />}
          {modal}
          {/* Extra bottom padding on mobile so the floating nav never covers
              the last row of content. */}
          <div className="min-h-30 container p-4 pb-20 sm:pb-4">
            <ErrorBoundary fallback={<ErrorFallback />}>
              <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
            </ErrorBoundary>
          </div>
          {mobileSidebar}
        </main>
      </div>
    </div>
  );
}
