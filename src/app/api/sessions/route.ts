import { NextResponse } from "next/server";
import pool from "@/lib/db";
import type { Session } from "@/lib/types";
import type { RowDataPacket } from "mysql2";

async function ensureTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(36) NOT NULL,
      screen_name VARCHAR(255) NOT NULL,
      components JSON NOT NULL,
      archetypes JSON NOT NULL,
      layout_description JSON NOT NULL,
      scenarios JSON NOT NULL,
      states JSON NOT NULL,
      active_state VARCHAR(255) NOT NULL,
      messages JSON,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      PRIMARY KEY (id)
    )
  `);
  await pool.execute(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS messages JSON`).catch(() => {});
}

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
    messages: row.messages ? (typeof row.messages === "string" ? JSON.parse(row.messages) : row.messages) : [],
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function GET() {
  try {
    await ensureTable();
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM sessions ORDER BY updated_at DESC"
    );
    return NextResponse.json(rows.map(rowToSession));
  } catch (err) {
    console.error("GET /api/sessions error:", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTable();
    const session: Session = await req.json();
    await pool.execute(
      `INSERT INTO sessions
        (id, screen_name, components, archetypes, layout_description, scenarios, states, active_state, messages, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        screen_name = VALUES(screen_name),
        components = VALUES(components),
        archetypes = VALUES(archetypes),
        layout_description = VALUES(layout_description),
        scenarios = VALUES(scenarios),
        states = VALUES(states),
        active_state = VALUES(active_state),
        messages = VALUES(messages),
        updated_at = VALUES(updated_at)`,
      [
        session.id,
        session.screenName,
        JSON.stringify(session.components),
        JSON.stringify(session.archetypes),
        JSON.stringify(session.layoutDescription),
        JSON.stringify(session.scenarios),
        JSON.stringify(session.states),
        session.activeState,
        JSON.stringify(session.messages ?? []),
        session.createdAt,
        session.updatedAt,
      ]
    );
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT * FROM sessions ORDER BY updated_at DESC"
    );
    return NextResponse.json(rows.map(rowToSession));
  } catch (err) {
    console.error("POST /api/sessions error:", err);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}
