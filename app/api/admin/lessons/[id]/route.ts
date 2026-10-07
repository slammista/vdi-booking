import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { LessonError, lessonInputSchema, saveLesson } from "@/lib/lessons";

type Ctx = { params: Promise<{ id: string }> };

async function readId(ctx: Ctx): Promise<number | null> {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) ? id : null;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  const id = await readId(ctx);
  if (id === null) return NextResponse.json({ error: "Id non valido." }, { status: 400 });

  const parsed = lessonInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Richiesta non valida." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await saveLesson(client, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof LessonError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Errore durante il salvataggio della lezione." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  const id = await readId(ctx);
  if (id === null) return NextResponse.json({ error: "Id non valido." }, { status: 400 });

  const result = await pool.query(`DELETE FROM lessons WHERE id = $1`, [id]);
  if (result.rowCount === 0) return NextResponse.json({ error: "Lezione non trovata." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
