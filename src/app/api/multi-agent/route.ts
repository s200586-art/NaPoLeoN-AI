import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const mock = async (name: string, ms: number) => {
    await new Promise((r) => setTimeout(r, ms));
    return `${name}:\n— понял запрос: ${prompt}\n— гипотеза: быстрое внедрение через MVP\n— next step: тест на 1 сценарии сегодня`;
  };

  const [Claude, Gemini, Codex] = await Promise.all([
    mock("Claude", 500),
    mock("Gemini", 700),
    mock("Codex", 600),
  ]);

  return NextResponse.json({ Claude, Gemini, Codex });
}
