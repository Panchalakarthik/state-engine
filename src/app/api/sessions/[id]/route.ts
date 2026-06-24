import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import type { Session } from "@/lib/types";

function rowToSession(row: RowDataPacket): Session {
  return {
    id: row.id,
    screenName: row.screen_name,
    components: typeof row.components === "string" ? JSON.parse(row.components) : row.components,
    archetypes: typeof row.archetypes === "string" ? JSON.parse(row.archetypes) : row.archetypes,
    layoutDescription: typeof row.layout_description === "string" ? JSON.parse(row.layout_description) : row.layout_description,
    scenarios: typeof row.scenarios === "string" ? JSON.parse(row.scenarios) : row.scenarios,
    states: typeof row.states === "string" ? JSON.parse(row.states) : row.states,
    activeState: row.active_state,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await pool.execute("DELETE FROM sessions WHERE id = ?", [id]);
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM sessions ORDER BY updated_at DESC"
    );
    return NextResponse.json(rows.map(rowToSession));
  } catch (err) {
    console.error("DELETE /api/sessions/[id] error:", err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { activeState } = await req.json();
    await pool.execute(
      "UPDATE sessions SET active_state = ?, updated_at = ? WHERE id = ?",
      [activeState, Date.now(), id]
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM sessions ORDER BY updated_at DESC"
    );
    return NextResponse.json(rows.map(rowToSession));
  } catch (err) {
    console.error("PATCH /api/sessions/[id] error:", err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
