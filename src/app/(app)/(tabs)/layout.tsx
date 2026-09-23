import { TabBar } from "@/components/ui";
import { requireOnboardedViewer } from "@/lib/viewer";

/** Screens reachable from the tab bar. Needs a finished onboarding. */
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  await requireOnboardedViewer();
  return (
    <>
      <main className="flex flex-1 flex-col px-5 pt-6 pb-[calc(84px+env(safe-area-inset-bottom)+24px)]">
        {children}
      </main>
      <TabBar />
    </>
  );
}
