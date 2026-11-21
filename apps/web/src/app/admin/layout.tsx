import type { Metadata } from "next";

/** Staff-only: never indexed (robots.ts also disallows /admin). */
export const metadata: Metadata = {
  title: { default: "Admin | FITR8", template: "%s | FITR8 Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return children;
}
