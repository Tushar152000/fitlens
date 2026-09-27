import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { bearerToken } from "@/lib/mobile-auth";

/** Ends the app's session: deletes the bearer token's row. */
export const POST = route(async (req) => {
  const token = bearerToken(req.headers.get("authorization"));
  if (token) await prisma.session.deleteMany({ where: { sessionToken: token } });
  return new NextResponse(null, { status: 204 });
});
