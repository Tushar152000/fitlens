/** Re-mounts on every tab navigation, so each screen eases in. */
export default function TabsTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 animate-page-in flex-col">{children}</div>;
}
