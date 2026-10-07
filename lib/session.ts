import { cookies } from "next/headers";
import { COOKIES, verifySessionToken, type SessionPayload } from "@/lib/auth";

/** Da usare in Server Components / Route Handlers (non in middleware). */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIES.SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
