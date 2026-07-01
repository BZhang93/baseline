import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { healthStatus } from "@/lib/health";

// Health check: confirms the app is up and can reach the database.
// GET /api/health  ->  200 { status: "ok", db: "up" } or 503 on DB failure.
export async function GET() {
  let dbUp = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbUp = true;
  } catch {
    dbUp = false;
  }

  const body = healthStatus(dbUp);
  return NextResponse.json(body, { status: dbUp ? 200 : 503 });
}
