import { NextResponse } from "next/server";
import { DEFAULT_PROMPT } from "@/store/settings";
export async function GET() {
  return NextResponse.json({ prompt: DEFAULT_PROMPT });
}
