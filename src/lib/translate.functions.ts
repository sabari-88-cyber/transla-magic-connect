import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const textSchema = z.object({
  text: z.string().min(1).max(5000),
  from: z.string().min(1),
  to: z.string().min(1),
});

const imageSchema = z.object({
  image: z.string().min(1),
  to: z.string().min(1),
});

const voiceSchema = z.object({
  audio: z.string().min(1),
  mimeType: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

function prompt(from: string, to: string) {
  const source = from === "auto" ? "the detected language" : from;
  return `Translate the text from ${source} into ${to}. Reply with the translation only: no quotes, no notes, no explanation.`;
}

export const translateText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => textSchema.parse(data))
  .handler(async ({ data }) => {
    const { askModel } = await import("./ai-gateway.server");
    const translation = await askModel([
      { type: "input_text", text: `${prompt(data.from, data.to)}\n\nText:\n${data.text}` },
    ]);
    return { translation };
  });

export const translateImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => imageSchema.parse(data))
  .handler(async ({ data }) => {
    const { askModel } = await import("./ai-gateway.server");
    const result = await askModel([
      {
        type: "input_text",
        text: `Read all text visible in this photo and translate it into ${data.to}. Reply with the translation only. If there is no readable text, reply exactly: No text found.`,
      },
      { type: "input_image", image_url: data.image },
    ]);
    return { translation: result };
  });

export const translateVoice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => voiceSchema.parse(data))
  .handler(async ({ data }) => {
    const { askModel, transcribe, speak } = await import("./ai-gateway.server");
    const bytes = Uint8Array.from(Buffer.from(data.audio, "base64"));
    const heard = await transcribe(bytes, data.mimeType);
    if (!heard) return { heard: "", translation: "", audio: "" };

    const translation = await askModel([
      { type: "input_text", text: `${prompt(data.from, data.to)}\n\nText:\n${heard}` },
    ]);
    const audio = await speak(translation);
    return { heard, translation, audio };
  });

export const speakText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ text: z.string().min(1).max(3000) }).parse(data))
  .handler(async ({ data }) => {
    const { speak } = await import("./ai-gateway.server");
    return { audio: await speak(data.text) };
  });
