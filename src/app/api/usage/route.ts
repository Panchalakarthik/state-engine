import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import pool from "@/lib/db";

const LIMIT = 3;

async function ensureTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS user_usage (
      user_id VARCHAR(255) PRIMARY KEY,
      question_count INT DEFAULT 0,
      updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
    )
  `);
}

async function getCount(userId: string): Promise<number> {
  const [rows] = await pool.execute(
    "SELECT question_count FROM user_usage WHERE user_id = ?",
    [userId]
  );
  return (rows as { question_count: number }[])[0]?.question_count ?? 0;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable();
  const count = await getCount(userId);
  return NextResponse.json({ count, limit: LIMIT, limitReached: count >= LIMIT });
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureTable();
  const count = await getCount(userId);

  if (count >= LIMIT) {
    return NextResponse.json({ count, limit: LIMIT, limitReached: true });
  }

  await pool.execute(
    `INSERT INTO user_usage (user_id, question_count)
     VALUES (?, 1)
     ON DUPLICATE KEY UPDATE question_count = question_count + 1`,
    [userId]
  );

  const newCount = count + 1;
  return NextResponse.json({ count: newCount, limit: LIMIT, limitReached: newCount >= LIMIT });
}
