import { cookies } from "next/headers";
import { COOKIES, verifyAdminSessionToken } from "@/lib/auth";

export async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get(COOKIES.ADMIN_COOKIE)?.value;
  if (!token) return false;
  return verifyAdminSessionToken(token);
}
