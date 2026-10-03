"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { success, type ActionState } from "../action-state";
import { requireUser } from "../auth";
import { APP_PATH } from "../config";

export async function markNotificationsRead(): Promise<ActionState> {
  const user = await requireUser();
  await getDb()
    .update(notifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  revalidatePath(APP_PATH, "layout");
  return success();
}
