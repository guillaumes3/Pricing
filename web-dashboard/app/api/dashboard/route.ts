import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getDashboardSnapshot();
  return NextResponse.json(snapshot, { status: 200 });
}
