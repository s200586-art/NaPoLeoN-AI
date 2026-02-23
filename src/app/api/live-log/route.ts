export async function GET() {
  const encoder = new TextEncoder();
  const events = [
    "Ищу релевантные данные...",
    "Читаю источники...",
    "Сравниваю варианты...",
    "Формирую ответ...",
    "Проверяю риски...",
    "Готово.",
  ];

  const stream = new ReadableStream({
    start(controller) {
      let i = 0;
      const tick = () => {
        const line = `${new Date().toLocaleTimeString("ru-RU")} · ${events[i % events.length]}`;
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
        i += 1;
      };

      tick();
      const id = setInterval(tick, 1800);

      // @ts-expect-error keep handle on controller
      controller._close = () => clearInterval(id);
    },
    cancel() {
      // no-op
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
