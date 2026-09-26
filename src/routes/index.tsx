import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeftRight,
  Camera,
  Check,
  Clipboard,
  Languages,
  Mic,
  Play,
  Sparkles,
  Square,
  Type,
  Upload,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { speakText, translateImage, translateText, translateVoice } from "@/lib/translate.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lingua — Text, Voice & Photo Translator" },
      { name: "description", content: "Translate text, speech, and photos across Indian and global languages." },
      { property: "og:title", content: "Lingua — Speak Beyond Borders" },
      { property: "og:description", content: "A fast translator for text, voice, and photos across Indian and global languages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const LANGUAGES = [
  "English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Kannada", "Malayalam",
  "Gujarati", "Punjabi", "Urdu", "Odia", "Assamese", "Maithili", "Sanskrit", "Konkani",
  "Nepali", "Sindhi", "Kashmiri", "Dogri", "Manipuri", "Bodo", "Santali", "Spanish",
  "French", "German", "Portuguese", "Italian", "Arabic", "Chinese", "Japanese", "Korean",
  "Russian", "Swedish", "Dutch", "Turkish", "Indonesian",
];

const LANGUAGE_TILES = [
  { name: "Hindi", script: "नमस्ते", tone: "bg-accent text-accent-foreground" },
  { name: "Tamil", script: "வணக்கம்", tone: "bg-primary text-primary-foreground" },
  { name: "Bengali", script: "নমস্কার", tone: "bg-foreground text-background" },
  { name: "Telugu", script: "నమస్కారం", tone: "bg-secondary text-secondary-foreground" },
  { name: "Arabic", script: "مرحباً", tone: "bg-card text-card-foreground" },
  { name: "Japanese", script: "こんにちは", tone: "bg-accent text-accent-foreground" },
];

type Tab = "text" | "voice" | "photo";

function LanguagePicker({ label, value, onChange, includeAuto }: { label: string; value: string; onChange: (value: string) => void; includeAuto?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <span className="mb-2 block text-[0.68rem] font-bold uppercase text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={`${label} language`} className="h-12 rounded-sm border-2 border-foreground bg-card px-4 text-base font-bold shadow-none focus:ring-2 focus:ring-ring">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80 rounded-sm border-2 border-foreground">
          {includeAuto && <SelectItem value="auto">Detect automatically</SelectItem>}
          {LANGUAGES.map((language) => <SelectItem key={language} value={language}>{language}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ModeButton({ mode, tab, onSelect, icon: Icon, children }: { mode: Tab; tab: Tab; onSelect: (tab: Tab) => void; icon: typeof Type; children: string }) {
  const active = mode === tab;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(mode)}
      aria-pressed={active}
      className={cn(
        "h-11 flex-1 rounded-sm border-2 border-transparent px-3 font-bold sm:flex-none sm:px-5",
        active ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background" : "hover:bg-secondary",
      )}
    >
      <Icon className="size-4" />
      {children}
    </Button>
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
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoResult, setPhotoResult] = useState("");
  const [copied, setCopied] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const doText = useServerFn(translateText);
  const doVoice = useServerFn(translateVoice);
  const doPhoto = useServerFn(translateImage);
  const doSpeak = useServerFn(speakText);
  const result = tab === "text" ? textResult : tab === "voice" ? voiceResult : photoResult;

  function fail(err: unknown) {
    setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
  }

  function playAudio(base64: string) {
    if (!base64) return;
    new Audio(`data:audio/wav;base64,${base64}`).play().catch(() => undefined);
  }

  async function handleText() {
    setError("");
    setBusy("Translating your words…");
    try {
      const response = await doText({ data: { text: input, from, to } });
      setTextResult(response.translation);
    } catch (err) { fail(err); } finally { setBusy(""); }
  }

  async function speakResult(text: string) {
    setError("");
    setBusy("Preparing audio…");
    try {
      const response = await doSpeak({ data: { text } });
      playAudio(response.audio);
    } catch (err) { fail(err); } finally { setBusy(""); }
  }

  async function startRecording() {
    setError(""); setHeard(""); setVoiceResult("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setBusy("Listening and translating…");
        try {
          const audio = await blobToBase64(new Blob(chunksRef.current, { type: "audio/webm" }));
          const response = await doVoice({ data: { audio, mimeType: "audio/webm", from, to } });
          if (!response.heard) { setError("No speech was heard. Please try recording again."); return; }
          setHeard(response.heard); setVoiceResult(response.translation); playAudio(response.audio);
        } catch (err) { fail(err); } finally { setBusy(""); }
      };
      recorder.start(); recorderRef.current = recorder; setRecording(true);
    } catch { setError("Microphone access was blocked. Please allow the microphone and try again."); }
  }

  function stopRecording() { recorderRef.current?.stop(); recorderRef.current = null; setRecording(false); }

  async function handlePhoto(file: File) {
    setError(""); setPhotoResult(""); setBusy("Reading the photo…");
    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoPreview(dataUrl);
      const response = await doPhoto({ data: { image: dataUrl, to } });
      setPhotoResult(response.translation);
    } catch (err) { fail(err); } finally { setBusy(""); }
  }

  function swapLanguages() {
    if (from === "auto") { setFrom(to); setTo("English"); return; }
    setFrom(to); setTo(from);
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-background px-3 py-3 text-foreground sm:px-6 sm:py-6 lg:px-8">
        <div className="mx-auto max-w-[88rem] overflow-hidden border-2 border-foreground bg-card shadow-[8px_8px_0_var(--foreground)]">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b-2 border-foreground px-4 py-4 sm:flex sm:flex-wrap sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center border-2 border-foreground bg-primary text-primary-foreground"><Languages className="size-6" /></div>
              <div className="min-w-0">
                <h1 className="truncate font-display text-3xl leading-none sm:text-4xl">Lingua</h1>
                <p className="hidden text-xs font-semibold uppercase text-muted-foreground sm:block">Speak beyond borders</p>
              </div>
            </div>
            <div className="col-span-2 flex w-full items-center gap-1 border-2 border-foreground bg-background p-1 sm:col-auto sm:w-auto">
              <ModeButton mode="text" tab={tab} onSelect={setTab} icon={Type}>Text</ModeButton>
              <ModeButton mode="voice" tab={tab} onSelect={setTab} icon={Mic}>Voice</ModeButton>
              <ModeButton mode="photo" tab={tab} onSelect={setTab} icon={Camera}>Photo</ModeButton>
            </div>
            <div className="hidden items-center gap-2 text-sm font-bold lg:flex"><Sparkles className="size-4 text-primary" /> 37 languages</div>
          </header>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="min-w-0 border-b-2 border-foreground lg:border-r-2 lg:border-b-0">
              <div className="grid gap-3 border-b-2 border-foreground bg-secondary p-4 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] sm:items-end sm:p-6">
                {tab !== "photo" ? <LanguagePicker label="Translate from" value={from} onChange={setFrom} includeAuto /> : <div className="hidden sm:block" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" size="icon" variant="outline" onClick={swapLanguages} disabled={tab === "photo"} aria-label="Swap languages" className="mx-auto size-12 rounded-sm border-2 border-foreground bg-card hover:bg-accent">
                      <ArrowLeftRight className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Swap languages</TooltipContent>
                </Tooltip>
                <LanguagePicker label="Translate to" value={to} onChange={setTo} />
              </div>

              <div className="grid min-h-[34rem] xl:grid-cols-2">
                <div className="flex min-h-[24rem] flex-col border-b-2 border-foreground p-5 xl:border-r-2 xl:border-b-0 sm:p-7">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-muted-foreground">{tab === "text" ? "Your words" : tab === "voice" ? "Your voice" : "Your photo"}</span>
                    {tab === "text" && <span className="text-xs font-semibold text-muted-foreground">{input.length} / 5000</span>}
                  </div>

                  {tab === "text" && (
                    <>
                      <textarea value={input} maxLength={5000} onChange={(event) => setInput(event.target.value)} placeholder="Type or paste anything…" className="min-h-60 flex-1 resize-none bg-transparent font-display text-3xl leading-snug outline-hidden placeholder:text-muted-foreground sm:text-4xl" />
                      <Button onClick={handleText} disabled={!input.trim() || busy !== ""} className="mt-5 h-14 rounded-sm border-2 border-foreground bg-primary text-base font-bold text-primary-foreground shadow-[4px_4px_0_var(--foreground)] hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-primary/90 hover:shadow-[2px_2px_0_var(--foreground)]">
                        <Languages className="size-5" /> Translate now
                      </Button>
                    </>
                  )}

                  {tab === "voice" && (
                    <div className="flex flex-1 flex-col items-center justify-center text-center">
                      <Button onClick={recording ? stopRecording : startRecording} disabled={busy !== ""} aria-label={recording ? "Stop recording and translate" : "Start speaking"} className={cn("size-32 rounded-full border-2 border-foreground shadow-[6px_6px_0_var(--foreground)] transition-transform hover:scale-105", recording ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground")}>
                        {recording ? <Square className="size-10" /> : <Mic className="size-12" />}
                      </Button>
                      <p className="mt-6 font-display text-3xl">{recording ? "Listening…" : "Tap and speak"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{recording ? "Tap again when you are finished" : "Your translation will play automatically"}</p>
                      {heard && <div className="mt-6 w-full border-2 border-foreground bg-secondary p-4 text-left"><span className="text-xs font-bold uppercase">You said</span><p className="mt-2 text-lg">{heard}</p></div>}
                    </div>
                  )}

                  {tab === "photo" && (
                    <div className="flex flex-1 flex-col">
                      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handlePhoto(file); }} className="sr-only" />
                      {photoPreview ? <img src={photoPreview} alt="Photo selected for translation" className="min-h-64 flex-1 border-2 border-foreground object-contain" /> : <button type="button" onClick={() => fileRef.current?.click()} className="grid min-h-72 flex-1 cursor-pointer place-items-center border-2 border-dashed border-foreground bg-secondary p-8 text-center transition-colors hover:bg-accent"><span><Upload className="mx-auto size-12" /><strong className="mt-4 block font-display text-3xl">Choose or take a photo</strong><span className="mt-2 block text-sm text-muted-foreground">Signs, menus, documents, or labels</span></span></button>}
                      {photoPreview && <Button variant="outline" onClick={() => fileRef.current?.click()} className="mt-4 h-12 rounded-sm border-2 border-foreground"><Camera /> Choose another photo</Button>}
                    </div>
                  )}
                </div>

                <div className="flex min-h-[24rem] flex-col bg-result p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Translation · {to}</span>
                    <div className="flex gap-2">
                      <Tooltip><TooltipTrigger asChild><Button type="button" size="icon" variant="outline" onClick={copyResult} disabled={!result} aria-label="Copy translation" className="size-11 rounded-sm border-2 border-foreground bg-card">{copied ? <Check /> : <Clipboard />}</Button></TooltipTrigger><TooltipContent>{copied ? "Copied" : "Copy translation"}</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild><Button type="button" size="icon" variant="outline" onClick={() => speakResult(result)} disabled={!result || busy !== ""} aria-label="Listen to translation" className="size-11 rounded-sm border-2 border-foreground bg-card"><Volume2 /></Button></TooltipTrigger><TooltipContent>Listen</TooltipContent></Tooltip>
                    </div>
                  </div>
                  <div aria-live="polite" className="flex flex-1 items-center py-8">
                    {busy ? <div><span className="inline-block size-3 animate-pulse rounded-full bg-primary" /><p className="mt-4 font-display text-3xl">{busy}</p></div> : result ? <p className="animate-fade-in whitespace-pre-wrap font-display text-4xl leading-snug sm:text-5xl">{result}</p> : <div className="text-muted-foreground"><Play className="mb-4 size-10" /><p className="font-display text-3xl sm:text-4xl">Your translation will appear here.</p></div>}
                  </div>
                  {error && <div role="alert" className="border-2 border-destructive bg-card p-4 text-sm font-semibold text-destructive">{error}</div>}
                </div>
              </div>
            </section>

            <aside className="grid grid-cols-2 bg-foreground p-3 text-background sm:grid-cols-3 lg:grid-cols-1" aria-label="Popular languages">
              <div className="col-span-2 p-3 sm:col-span-3 lg:col-span-1">
                <span className="text-xs font-bold uppercase text-background/70">Popular languages</span>
                <h2 className="mt-1 font-display text-3xl">One world,<br />many voices.</h2>
              </div>
              {LANGUAGE_TILES.map((language) => (
                <Button key={language.name} type="button" variant="ghost" onClick={() => setTo(language.name)} className={cn("m-1 h-auto min-h-24 flex-col items-start rounded-sm border-2 border-background/80 p-4 text-left shadow-none transition-transform hover:-translate-y-1 hover:text-inherit", language.tone)}>
                  <span className="font-display text-2xl leading-none">{language.script}</span>
                  <span className="mt-3 text-[0.68rem] font-bold uppercase">{language.name}</span>
                </Button>
              ))}
            </aside>
          </div>

          <footer className="grid gap-2 border-t-2 border-foreground bg-accent px-4 py-3 text-xs font-bold uppercase sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
            <span>Text · Voice · Photo</span>
            <span className="text-muted-foreground">Indian and global languages</span>
          </footer>
        </div>
      </main>
    </TooltipProvider>
  );
}

function blobToBase64(blob: Blob): Promise<string> { return fileToDataUrl(blob).then((dataUrl) => dataUrl.split(",")[1] ?? ""); }
function fileToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
}