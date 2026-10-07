import { NextResponse } from "next/server";
import { COOKIES } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIES.SESSION_COOKIE);
  return res;
}
