import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// Proxy so callers keep `anthropic.messages.create(...)` API unchanged
// while deferring instantiation until the first actual API call
export const anthropic: Anthropic = new Proxy({} as Anthropic, {
  get(_, prop: string | symbol) {
    return Reflect.get(getClient(), prop);
  },
});
