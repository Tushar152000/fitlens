import { OfflineBanner } from "@/components/offline-banner";
import { requireViewer } from "@/lib/server/api";

/**
 * Every page under (app) requires a signed-in user. Tab screens get a sidebar on desktop
 * ((tabs)/layout); full-screen flows keep a centred 480 px column (AppColumn).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <OfflineBanner />
      {children}
    </div>
  );
}
