import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { prisma } from "@/lib/db";

// Auth.js reads AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and AUTH_RESEND_KEY from env.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const providers: Provider[] = [Google];
  if (process.env.AUTH_RESEND_KEY) {
    providers.push(Resend({ from: process.env.AUTH_EMAIL_FROM }));
  }
  return {
    adapter: PrismaAdapter(prisma),
    session: { strategy: "database" },
    providers,
    pages: { signIn: "/login" },
    callbacks: {
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  };
});
