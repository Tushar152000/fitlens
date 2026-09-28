import { OfflineBanner } from "@/components/offline-banner";
import { requireViewer } from "@/lib/server/api";

/** Every page under (app) requires a signed-in user. Mobile-first: a centred 480 px column on wider screens. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-ground">
      <OfflineBanner />
      {children}
    </div>
  );
}
