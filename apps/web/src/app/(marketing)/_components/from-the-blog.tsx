import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { latestPosts } from "@/lib/server/blog";
import { PostCard } from "../blog/_components/post-card";
import { hardButton, ctaArrow } from "./cta";
import { PillWord, SectionHead } from "./section-head";

/** The newest blog posts on the landing page (internal links help both readers and search). Hidden until there are posts. */
export async function FromTheBlog() {
  const posts = await latestPosts(3);
  if (!posts.length) return null;
  return (
    <section
      id="blog"
      aria-labelledby="blog-heading"
      className="scroll-mt-16 bg-white py-16 sm:py-28"
    >
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-10">
        <SectionHead
          id="blog-heading"
          kicker="From the blog"
          title={
            <>
              Learn the <PillWord>why</PillWord> behind your numbers.
            </>
          }
          aside="Short, source-backed guides on Indian food, protein, calories and training from the FITR8 team."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link href="/blog" className={cn(hardButton, "bg-fitr8 text-white")}>
            Read the blog
            <ArrowRight className={ctaArrow} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
