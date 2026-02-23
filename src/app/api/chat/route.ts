import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const answer = `Принял: "${prompt}"\n\nMVP-ответ (mock):\n1) Уточняю цель\n2) Декомпозирую шаги\n3) Даю план выполнения`;
  return NextResponse.json({ answer });
}
