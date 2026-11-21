"use client";

import {
  ArrowUpRight,
  FileText,
  FolderTree,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  LogOut,
  Tags,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminMeDto } from "@fitr8/contracts";
import { STAFF_ROLE_LABELS } from "@fitr8/domain/staff";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";
import { NewPostButton } from "./new-post-button";
import { signOutOfAdmin } from "./sign-out";

interface NavItem {
  href: string;
  label: string;
  icon: typeof FileText;
  show?: (me: AdminMeDto) => boolean;
}

/**
 * The admin's menu. General items first, then one group per section. To add a section: add a group
 * here, its pages under app/admin/(panel)/<section>, and its card on the admin home.
 */
const GENERAL: NavItem[] = [
  { href: "/admin", label: "Home", icon: Home },
  { href: "/admin/team", label: "Team", icon: Users },
];

const SECTIONS: {
  key: string;
  label: string;
  href: string;
  items: NavItem[];
  action?: React.ReactNode;
}[] = [
  {
    key: "blog",
    label: "Blog",
    href: "/admin/blog",
    action: <NewPostButton compact />,
    items: [
      { href: "/admin/blog", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/blog/posts", label: "Posts", icon: FileText },
      { href: "/admin/blog/media", label: "Media", icon: ImageIcon },
      {
        href: "/admin/blog/categories",
        label: "Categories",
        icon: FolderTree,
        show: (m) => m.sections.blog.manageContent,
      },
      {
        href: "/admin/blog/tags",
        label: "Tags",
        icon: Tags,
        show: (m) => m.sections.blog.manageContent,
      },
      {
        href: "/admin/blog/redirects",
        label: "Redirects",
        icon: Link2,
        show: (m) => m.sections.blog.manageContent,
      },
      { href: "/admin/blog/profile", label: "Author profile", icon: UserRound },
    ],
  },
];

/** Admin sidebar (lg+) and the scrolling top bar on smaller screens. Active = brand tint + left bar. */
export function AdminNav({ me }: { me: AdminMeDto }) {
  const pathname = usePathname();
  const visible = (items: NavItem[]) => items.filter((n) => !n.show || n.show(me));
  // Section roots (/admin, /admin/blog) are active only on themselves; others also on sub-pages.
  const roots = new Set(["/admin", ...SECTIONS.map((s) => s.href)]);
  const active = (href: string) =>
    roots.has(href) ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const section = SECTIONS.find((s) => pathname === s.href || pathname.startsWith(`${s.href}/`));

  const link = ({ href, label, icon: Icon }: NavItem) => (
    <Link
      key={href}
      href={href}
      aria-current={active(href) ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-input px-3 text-[15px] font-semibold transition-colors",
        active(href)
          ? "bg-brand/8 text-brand before:absolute before:inset-y-2 before:-left-4 before:w-1 before:rounded-r-full before:bg-brand"
          : "text-ink-2 hover:bg-sunken",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 px-2" aria-label="Admin home">
          <Logo />
          <span className="font-display text-[15px] font-bold text-ink-3">Admin</span>
        </Link>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Admin">
          {visible(GENERAL).map(link)}
          {SECTIONS.map((s) => (
            <div key={s.key} className="mt-5 flex flex-col gap-1">
              <p className="px-3 text-[11px] font-bold tracking-[0.08em] text-ink-3 uppercase">
                {s.label}
              </p>
              {s.action && <div className="mb-1">{s.action}</div>}
              {visible(s.items).map(link)}
            </div>
          ))}
          <a
            href="/blog"
            target="_blank"
            rel="noopener"
            className="mt-3 flex h-10 items-center gap-3 rounded-input px-3 text-[15px] font-semibold text-ink-2 hover:bg-sunken"
          >
            <ArrowUpRight className="size-5" aria-hidden />
            View blog
          </a>
        </nav>
        <div className="mt-auto rounded-card bg-ground p-3">
          <p className="truncate text-[14px] font-semibold">{me.staff.name}</p>
          <p className="truncate text-[12px] font-semibold text-ink-3">
            {STAFF_ROLE_LABELS[me.staff.role]} · {me.staff.email}
          </p>
          <button
            type="button"
            onClick={signOutOfAdmin}
            className="mt-2 flex h-9 items-center gap-2 text-[13px] font-semibold text-ink-2 hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/admin" aria-label="Admin home">
            <Logo />
          </Link>
          {section?.action && <div className="ml-auto w-36">{section.action}</div>}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin">
          {[...visible(GENERAL), ...(section ? visible(section.items) : [])].map(
            ({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center rounded-full px-3.5 text-[14px] font-semibold",
                  active(href) ? "bg-ink text-white" : "bg-chip text-ink-2",
                )}
              >
                {label}
              </Link>
            ),
          )}
          {!section &&
            SECTIONS.map((s) => (
              <Link
                key={s.key}
                href={s.href}
                className="flex h-9 shrink-0 items-center rounded-full bg-chip px-3.5 text-[14px] font-semibold text-ink-2"
              >
                {s.label}
              </Link>
            ))}
        </nav>
      </header>
    </>
  );
}
