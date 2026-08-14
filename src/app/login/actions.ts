"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

export type LoginState = { error?: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (result?.error) {
      return { error: "電郵或密碼錯誤" };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "電郵或密碼錯誤" };
    }
    throw error;
  }

  redirect("/account/pets");
}
