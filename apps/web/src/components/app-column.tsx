/** Full-screen flows (log, coach, onboarding) stay a centred 480 px phone column at every width. */
export function AppColumn({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">{children}</div>;
}
