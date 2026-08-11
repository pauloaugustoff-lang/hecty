"use server";

import { revalidatePath } from "next/cache";
import { setCurrentSpaceCookie } from "@/lib/spaces/current-space";

export async function switchSpaceAction(formData: FormData) {
  const spaceId = formData.get("spaceId");
  if (typeof spaceId !== "string" || !spaceId) return;
  await setCurrentSpaceCookie(spaceId);
  revalidatePath("/", "layout");
}
