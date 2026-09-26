const GATEWAY = "https://ai.gateway.lovable.dev";
const CHAT_MODEL = "openai/gpt-6-astra";
const TRANSCRIBE_MODEL = "google/gemini-3.5-transcribe";
const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project.");
  return key;
}

async function failure(response: Response) {
  const body = await response.text().catch(() => "");
  if (response.status === 429) return new Error("Too many requests right now. Please try again in a moment.");
  if (response.status === 402) return new Error("AI credits are exhausted. Please top up to keep translating.");
  return new Error(body || `Request failed (${response.status}).`);
}

async function* sseEvents(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          yield JSON.parse(data) as Record<string, unknown>;
        } catch {
          /* ignore keep-alive fragments */
        }
      }
    }
  }
}

type Part = { type: "input_text"; text: string } | { type: "input_image"; image_url: string };

export async function askModel(parts: Part[]): Promise<string> {
  const response = await fetch(`${GATEWAY}/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      input: [{ role: "user", content: parts }],
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });
  if (!response.ok || !response.body) throw await failure(response);

  let text = "";
  for await (const event of sseEvents(response)) {
    if (event["type"] === "response.output_text.delta" && typeof event["delta"] === "string") {
      text += event["delta"];
    }
  }
  if (!text.trim()) throw new Error("No translation was returned. Please try again.");
  return text.trim();
}

export async function transcribe(bytes: Uint8Array, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mimeType }), "audio.webm");
  form.append("model", TRANSCRIBE_MODEL);
  form.append("stream", "true");

  const response = await fetch(`${GATEWAY}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!response.ok || !response.body) throw await failure(response);

  let text = "";
  for await (const event of sseEvents(response)) {
    const type = event["type"];
    if (type === "transcript.text.delta" && typeof event["delta"] === "string") text += event["delta"];
    if (type === "transcript.text.done" && typeof event["text"] === "string" && !text) text = event["text"];
  }
  return text.trim();
}

export async function speak(text: string): Promise<string> {
  const response = await fetch(`${GATEWAY}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
      stream_format: "audio",
    }),
  });
  if (!response.ok) throw await failure(response);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}
