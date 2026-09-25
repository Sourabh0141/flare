/** An OpenAI-style streaming chat response that emits the given text in small chunks. */
export function chatStreamResponse(text: string, chunkSize = 7): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < text.length; i += chunkSize) {
        const piece = text.slice(i, i + chunkSize);
        const frame = { choices: [{ delta: { content: piece } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export function mp3Response(bytes: number[] = [0xff, 0xfb, 0x90, 0]): Response {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'content-type': 'audio/mpeg' },
  });
}

/** Parses a server-sent event stream into the JSON payloads of its "turn" events. */
export async function readTurnEvents<T = Record<string, unknown>>(
  response: Response
): Promise<T[]> {
  const text = await response.text();
  const events: T[] = [];
  for (const block of text.split('\n\n')) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    if (data) events.push(JSON.parse(data) as T);
  }
  return events;
}

import type { TurnEvent } from '@flare/contracts';

type EventOf<T extends TurnEvent['type']> = Extract<TurnEvent, { type: T }>;

/** The first event of a type, or a failed assertion. */
export function eventOfType<T extends TurnEvent['type']>(events: TurnEvent[], type: T): EventOf<T> {
  const found = events.find((e): e is EventOf<T> => e.type === type);
  if (!found) throw new Error(`No "${type}" event in [${events.map((e) => e.type).join(', ')}]`);
  return found;
}

export function eventsOfType<T extends TurnEvent['type']>(
  events: TurnEvent[],
  type: T
): EventOf<T>[] {
  return events.filter((e): e is EventOf<T> => e.type === type);
}

/** The last event on the stream, narrowed to a type, or a failed assertion. */
export function lastEvent<T extends TurnEvent['type']>(events: TurnEvent[], type: T): EventOf<T> {
  const last = events.at(-1);
  if (!last || last.type !== type) {
    throw new Error(`Expected last event "${type}", got "${last?.type ?? 'none'}"`);
  }
  return last as EventOf<T>;
}
