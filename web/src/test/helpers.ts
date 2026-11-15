import { vi } from "vitest";

type Reply = { status: number; body?: unknown } | Error;

export function mockFetch(handler: (url: string, init?: RequestInit) => Reply) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const reply = handler(String(input), init);
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

export const TOKEN_KEY = "kokpit_token";
