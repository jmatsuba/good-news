import { NextResponse } from "next/server";
import { listAllTags } from "@/lib/articles";

export async function GET() {
  const tags = await listAllTags();
  return NextResponse.json({
    tags: tags.map((t) => ({ slug: t.slug, label: t.label })),
  });
}
