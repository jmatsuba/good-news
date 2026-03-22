import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingest";

function tokenMatches(token: string): boolean {
  if (!token) return false;
  return (
    (!!process.env.INGEST_SECRET && token === process.env.INGEST_SECRET) ||
    (!!process.env.CRON_SECRET && token === process.env.CRON_SECRET)
  );
}

function authOk(req: NextRequest): boolean {
  const q = req.nextUrl.searchParams.get("secret")?.trim();
  if (q && tokenMatches(q)) return true;

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  return tokenMatches(token);
}

function htmlPage(body: { ok: boolean; fetchedCount?: number; newCount?: number; publishedCount?: number; rejectedCount?: number; error?: string }) {
  const ok = body.ok;
  const title = ok ? "Ingest finished" : "Ingest failed";
  const rows = ok
    ? `<ul style="margin:1rem 0;padding-left:1.25rem;line-height:1.7">
        <li>Fetched: <strong>${body.fetchedCount ?? 0}</strong></li>
        <li>New URLs: <strong>${body.newCount ?? 0}</strong></li>
        <li>Published: <strong>${body.publishedCount ?? 0}</strong></li>
        <li>Rejected: <strong>${body.rejectedCount ?? 0}</strong></li>
      </ul>`
    : `<p style="color:#b91c1c">${escapeHtml(body.error ?? "Unknown error")}</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(title)} · Good News</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1c1917; }
    a { color: #92400e; }
  </style>
</head>
<body>
  <h1 style="font-size:1.25rem;font-weight:600">${escapeHtml(title)}</h1>
  ${rows}
  <p><a href="/">← Back to site</a></p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIngestion();
    const payload = { ok: true as const, ...result };
    const ui = req.nextUrl.searchParams.get("ui") === "1";
    if (ui) {
      return new NextResponse(htmlPage(payload), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest failed";
    const ui = req.nextUrl.searchParams.get("ui") === "1";
    if (ui) {
      return new NextResponse(htmlPage({ ok: false, error: message }), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIngestion();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
