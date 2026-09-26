import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  speakText,
  translateImage,
  translateText,
  translateVoice,
} from "@/lib/translate.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Simple Translator - Text, Voice and Photo" },
      {
        name: "description",
        content:
          "Translate text, speech and photos between any languages with a simple, easy to use translator.",
      },
      { property: "og:title", content: "Simple Translator - Text, Voice and Photo" },
      {
        property: "og:description",
        content: "Translate typed text, spoken words and photos between any languages.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const LANGUAGES = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Bengali",
  "Marathi",
  "Kannada",
  "Malayalam",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Odia",
  "Assamese",
  "Maithili",
  "Sanskrit",
  "Konkani",
  "Nepali",
  "Sindhi",
  "Kashmiri",
  "Dogri",
  "Manipuri",
  "Bodo",
  "Santali",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Italian",
  "Arabic",
  "Chinese",
  "Japanese",
  "Korean",
  "Russian",
  "Swedish",
  "Dutch",
  "Turkish",
  "Indonesian",
];

type Tab = "text" | "voice" | "photo";

function LanguagePicker({
  label,
  value,
  onChange,
  includeAuto,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  includeAuto?: boolean;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-border bg-card px-3 py-2 text-base text-foreground"
      >
        {includeAuto && <option value="auto">Detect automatically</option>}
        {LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {language}
          </option>
        ))}
      </select>
    </label>
  );
}

function Result({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">Translation</p>
      <p className="mt-1 whitespace-pre-wrap text-lg text-foreground">{text}</p>
    </div>
  );
}

function Index() {
  const [tab, setTab] = useState<Tab>("text");
  const [from, setFrom] = useState("auto");
  const [to, setTo] = useState("English");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const [input, setInput] = useState("");
  const [textResult, setTextResult] = useState("");

  const [recording, setRecording] = useState(false);
  const [heard, setHeard] = useState("");
  const [voiceResult, setVoiceResult] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [photoPreview, setPhotoPreview] = useState("");
  const [photoResult, setPhotoResult] = useState("");

  const doText = useServerFn(translateText);
  const doVoice = useServerFn(translateVoice);
  const doPhoto = useServerFn(translateImage);
  const doSpeak = useServerFn(speakText);

  function fail(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
  }

  function playAudio(base64: string) {
    if (!base64) return;
    new Audio(`data:audio/wav;base64,${base64}`).play().catch(() => undefined);
  }

  async function handleText() {
    setError("");
    setBusy("Translating...");
    try {
      const result = await doText({ data: { text: input, from, to } });
      setTextResult(result.translation);
    } catch (err) {
      fail(err);
    } finally {
      setBusy("");
    }
  }

  async function speakResult(text: string) {
    setError("");
    setBusy("Preparing audio...");
    try {
      const result = await doSpeak({ data: { text } });
      playAudio(result.audio);
    } catch (err) {
      fail(err);
    } finally {
      setBusy("");
    }
  }

  async function startRecording() {
    setError("");
    setHeard("");
    setVoiceResult("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setBusy("Listening and translating...");
        try {
          const base64 = await blobToBase64(blob);
          const result = await doVoice({
            data: { audio: base64, mimeType: "audio/webm", from, to },
          });
          if (!result.heard) {
            setError("No speech was heard. Please try recording again.");
            return;
          }
          setHeard(result.heard);
          setVoiceResult(result.translation);
          playAudio(result.audio);
        } catch (err) {
          fail(err);
        } finally {
          setBusy("");
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Microphone access was blocked. Please allow the microphone and try again.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function handlePhoto(file: File) {
    setError("");
    setPhotoResult("");
    setBusy("Reading the photo...");
    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoPreview(dataUrl);
      const result = await doPhoto({ data: { image: dataUrl, to } });
      setPhotoResult(result.translation);
    } catch (err) {
      fail(err);
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-primary">Simple Translator</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Translate typed text, your voice, or text in a photo.
      </p>

      <div className="mt-4 flex gap-2">
        {(["text", "voice", "photo"] as Tab[]).map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium ${
              tab === item
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-accent"
            }`}
          >
            {item === "text" ? "Text" : item === "voice" ? "Voice" : "Photo"}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        {tab !== "photo" && (
          <LanguagePicker label="From" value={from} onChange={setFrom} includeAuto />
        )}
        <LanguagePicker label="To" value={to} onChange={setTo} />
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-destructive bg-card p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {busy && <p className="mt-4 text-sm text-muted-foreground">{busy}</p>}

      {tab === "text" && (
        <section className="mt-4 flex flex-col gap-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={5}
            placeholder="Type or paste text here"
            className="w-full rounded-md border border-border bg-card p-3 text-base text-foreground"
          />
          <button
            onClick={handleText}
            disabled={!input.trim() || busy !== ""}
            className="rounded-md bg-primary px-4 py-3 text-base font-medium text-primary-foreground disabled:opacity-50"
          >
            Translate
          </button>
          <Result text={textResult} />
          {textResult && (
            <button
              onClick={() => speakResult(textResult)}
              disabled={busy !== ""}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Listen
            </button>
          )}
        </section>
      )}

      {tab === "voice" && (
        <section className="mt-4 flex flex-col gap-3">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={busy !== ""}
            className="rounded-md bg-primary px-4 py-4 text-base font-medium text-primary-foreground disabled:opacity-50"
          >
            {recording ? "Stop and translate" : "Start speaking"}
          </button>
          {heard && (
            <div className="rounded-md border border-border bg-card p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">You said</p>
              <p className="mt-1 text-base text-foreground">{heard}</p>
            </div>
          )}
          <Result text={voiceResult} />
          {voiceResult && (
            <button
              onClick={() => speakResult(voiceResult)}
              disabled={busy !== ""}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Play again
            </button>
          )}
        </section>
      )}

      {tab === "photo" && (
        <section className="mt-4 flex flex-col gap-3">
          <label className="rounded-md border border-border bg-card p-3 text-sm text-foreground">
            <span className="font-medium">Take a photo or choose one</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handlePhoto(file);
              }}
              className="mt-2 block w-full text-sm"
            />
          </label>
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Photo to translate"
              className="max-h-64 w-full rounded-md border border-border object-contain"
            />
          )}
          <Result text={photoResult} />
          {photoResult && (
            <button
              onClick={() => speakResult(photoResult)}
              disabled={busy !== ""}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
            >
              Listen
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return fileToDataUrl(blob).then((dataUrl) => dataUrl.split(",")[1] ?? "");
}

function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
}
