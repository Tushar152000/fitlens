import { marketingFontVars } from "@/lib/fitr8-fonts";

/** Signed-in web home: the website's look, no app shell. */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${marketingFontVars} flex flex-1 flex-col font-jakarta text-fitr8-ink antialiased`}
    >
      {children}
    </div>
  );
}
