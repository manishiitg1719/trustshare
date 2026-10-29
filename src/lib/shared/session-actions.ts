"use server";
// SHARED CONTRACT. Demo sign-in and reset, used by the role switcher and the Judge Start Here page.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { USER_COOKIE } from "./auth";
import { resetDemo } from "./seed";

export async function switchUser(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const store = await cookies();
  if (userId) store.set(USER_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  else store.delete(USER_COOKIE);
  revalidatePath("/", "layout");
  redirect(String(formData.get("next") ?? "/resources"));
}

export async function resetDemoAction(): Promise<void> {
  await resetDemo();
  revalidatePath("/", "layout");
  redirect("/start?reset=1");
}
