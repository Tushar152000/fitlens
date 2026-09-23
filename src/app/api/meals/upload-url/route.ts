import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { mealPhotoKey, presignUpload } from "@/lib/storage/s3";
import { UploadUrlSchema } from "@/lib/validators";

/** Step 1 of photo logging: get a signed URL, then PUT the (compressed) image to it from the browser. */
export const POST = route(async (req) => {
  const userId = await requireUserId();
  const { contentType } = await parseBody(req, UploadUrlSchema);
  const key = mealPhotoKey(userId, contentType);
  const uploadUrl = await presignUpload(key, contentType);
  return NextResponse.json({ key, uploadUrl, expiresIn: 300 });
});
