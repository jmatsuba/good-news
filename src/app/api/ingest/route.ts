import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingest";

function authOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  return (
    (!!process.env.INGEST_SECRET && token === process.env.INGEST_SECRET) ||
    (!!process.env.CRON_SECRET && token === process.env.CRON_SECRET)
  );
}

async function handleIngest() {
  try {
    const result = await runIngestion();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleIngest();
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handleIngest();
}
