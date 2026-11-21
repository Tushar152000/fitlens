import Link from "next/link";
import type { BlogCategoryDto } from "@fitr8/contracts";
import { cn } from "@/lib/cn";

/** Category pills under the intro: All · Nutrition · Training … */
export function TopicBar({
  categories,
  active,
}: {
  categories: BlogCategoryDto[];
  active?: string;
}) {
  if (!categories.length) return null;
  const pill = (on: boolean) =>
    cn(
      "flex h-10 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold transition-colors",
      on ? "bg-fitr8 text-white" : "bg-fitr8-soft text-fitr8-ink hover:bg-fitr8-lilac-soft",
    );
  return (
    <nav aria-label="Topics" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-2 pb-1">
        <li>
          <Link href="/blog" className={pill(!active)}>
            All posts
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/blog/category/${c.slug}`} className={pill(active === c.slug)}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
