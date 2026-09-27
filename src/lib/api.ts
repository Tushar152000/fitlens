import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { auth } from "@/auth";
import { userIdFromBearer } from "@/lib/mobile-auth";

import { HttpError } from "./http-error";

export { HttpError };

/** Signed-in user from the web session cookie, or the native app's bearer token. */
export async function requireUserId(): Promise<string> {
  const bearer = (await headers()).get("authorization");
  if (bearer) {
    const id = await userIdFromBearer(bearer);
    if (!id) throw new HttpError(401, "Not signed in");
    return id;
  }
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new HttpError(401, "Not signed in");
  return id;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
  return schema.parse(json);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler with consistent JSON errors. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json(
          { error: err.message, details: err.details },
          { status: err.status },
        );
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
