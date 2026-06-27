"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, Zap, CheckCircle2, Copy, ChevronDown, ChevronUp, History, Save } from "lucide-react";

interface AgentChatProps {
  listingId: string;
  productName: string;
  inline?: boolean;
  onApplyChanges?: (changes: {
    title?: string | null;
    bullets?: string[] | null;
    description?: string | null;
  }) => void;
}

interface Changes {
  title?: string | null;
  bullets?: string[] | null;
  description?: string | null;
  _warning?: string | null;
}

interface Message {
  role: "user" | "assistant" | "changes";
  content: string;
  isTyping?: boolean;
  isNew?: boolean;
  isProactive?: boolean;
  changes?: Changes;
}

const QUICK_ACTIONS = [
  { label: "✂️ Acortar", command: "Acórtala a unas 100 palabras conservando los datos clave" },
  { label: "📏 Alargar", command: "Extiéndela con más detalle y beneficios, hasta unas 250 palabras" },
  { label: "💼 Formal", command: "Hazla más formal y profesional, tono corporativo" },
  { label: "⚡ Juvenil", command: "Hazla más juvenil, directa y fresca" },
  { label: "❤️ Emocional", command: "Hazla más emotiva, conectada al sentimiento del usuario" },
  { label: "🔧 Técnica", command: "Hazla más técnica, destacando especificaciones y datos concretos" },
  { label: "🎯 SEO", command: "Optimiza para SEO: inserta palabras clave en posiciones naturales" },
  { label: "🛡️ Confianza", command: "Añade elementos de confianza: garantías, certificaciones y casos de uso reales" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

// Character-by-character reveal — completes in ~650ms regardless of text length
function AnimatedText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!text) return;
    setDisplayed("");
    let i = 0;
    const step = Math.max(1, Math.floor(text.length / 40));
    const id = setInterval(() => {
      i = Math.min(i + step, text.length);
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [text]);

  const isDone = displayed.length >= text.length;

  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {displayed}
      {!isDone && (
        <span className="inline-block w-px h-3.5 bg-gray-500 ml-px opacity-75 animate-pulse" />
      )}
    </p>
  );
}

function ChangeCard({
  changes,
  listingId,
  onSaved,
}: {
  changes: Changes;
  listingId: string;
  onSaved?: () => void;
}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [bulletsExpanded, setBulletsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleSave = async () => {
    setSaveState("saving");
    try {
      const body: Record<string, unknown> = {};
      if (changes.title) body.title = changes.title;
      if (changes.bullets?.length) body.bullets = changes.bullets;
      if (changes.description) body.description = changes.description;

      const res = await fetch(`/api/listings/${listingId}/save`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
      onSaved?.();
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const hasChanges =
    (changes.title && changes.title.trim()) ||
    (changes.bullets && changes.bullets.length > 0) ||
    (changes.description && changes.description.trim());

  if (!hasChanges) return null;

  const visibleBullets = bulletsExpanded
    ? changes.bullets ?? []
    : (changes.bullets ?? []).slice(0, 3);
  const hasMoreBullets = (changes.bullets ?? []).length > 3;

  const descPreview = changes.description
    ? descExpanded
      ? changes.description
      : changes.description.slice(0, 180) + (changes.description.length > 180 ? "…" : "")
    : null;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden text-xs w-full max-w-[90%]">
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
        <span className="text-white font-semibold text-xs">Cambios listos</span>
      </div>

      <div className="p-3 space-y-2.5">
        {changes.title && changes.title.trim() && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-green-800 uppercase tracking-wide" style={{ fontSize: "10px" }}>Título</span>
              <button onClick={() => copyToClipboard(changes.title!, "title")} className="flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors">
                <Copy className="h-3 w-3" />
                <span>{copiedField === "title" ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <p className="text-gray-800 leading-snug bg-white rounded-lg px-2.5 py-1.5 border border-green-100">{changes.title}</p>
          </div>
        )}

        {changes.bullets && changes.bullets.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-green-800 uppercase tracking-wide" style={{ fontSize: "10px" }}>Bullets ({changes.bullets.length})</span>
              <button onClick={() => copyToClipboard(changes.bullets!.join("\n"), "bullets")} className="flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors">
                <Copy className="h-3 w-3" />
                <span>{copiedField === "bullets" ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <ul className="space-y-1">
              {visibleBullets.map((b, i) => (
                <li key={i} className="flex items-start gap-1.5 bg-white rounded-lg px-2.5 py-1.5 border border-green-100">
                  <span className="text-green-500 shrink-0 mt-0.5">•</span>
                  <span className="text-gray-800 leading-snug">{b}</span>
                </li>
              ))}
            </ul>
            {hasMoreBullets && (
              <button
                onClick={() => setBulletsExpanded((v) => !v)}
                className="mt-1 flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
              >
                {bulletsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {bulletsExpanded ? "Ver menos" : `Ver ${changes.bullets.length - 3} más`}
              </button>
            )}
          </div>
        )}

        {changes.description && changes.description.trim() && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-green-800 uppercase tracking-wide" style={{ fontSize: "10px" }}>Descripción</span>
              <button onClick={() => copyToClipboard(changes.description!, "description")} className="flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors">
                <Copy className="h-3 w-3" />
                <span>{copiedField === "description" ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <div className="bg-white rounded-lg px-2.5 py-1.5 border border-green-100">
              <p className="text-gray-800 leading-snug whitespace-pre-wrap">{descPreview}</p>
              {changes.description.length > 180 && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-1 flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                >
                  {descExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {descExpanded ? "Ver menos" : "Ver más"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Warning: possible invented specs */}
        {changes._warning && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-xs text-amber-800">
            <span className="shrink-0 text-sm">⚠️</span>
            <span>{changes._warning}</span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saveState === "saving" || saveState === "saved"}
          className={`w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
            saveState === "saved"
              ? "bg-green-700 text-white cursor-default"
              : saveState === "error"
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : saveState === "saving"
              ? "bg-green-400 text-white cursor-wait"
              : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {saveState === "saving" ? (
            <><Loader2 className="h-3 w-3 animate-spin" />Guardando...</>
          ) : saveState === "saved" ? (
            <><CheckCircle2 className="h-3 w-3" />Guardado en el producto</>
          ) : saveState === "error" ? (
            "Error — inténtalo de nuevo"
          ) : (
            <><Save className="h-3 w-3" />Guardar en el producto</>
          )}
        </button>
      </div>
    </div>
  );
}

export default function AgentChat({ listingId, productName, inline = false, onApplyChanges }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historicalCount, setHistoricalCount] = useState(0);
  const [credits, setCredits] = useState<number>(0);
  const [plan, setPlan] = useState("free");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const analyzedRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/agent/credits/status")
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? 0);
        setPlan(d.plan ?? "free");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setHistoricalCount(0);
    setLoadingHistory(true);

    fetch(`/api/agent/conversation?listingId=${listingId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.conversation) {
          const stored = d.conversation.messages as { role: string; content: string }[];
          const mapped: Message[] = stored.flatMap((m) => {
            if (m.role === "assistant") {
              try {
                const parsed = JSON.parse(m.content) as Record<string, unknown>;
                if (parsed && typeof parsed.message === "string") {
                  const changes: Changes = {
                    title: typeof parsed.updatedTitle === "string" ? parsed.updatedTitle : null,
                    bullets: Array.isArray(parsed.updatedBullets) ? (parsed.updatedBullets as string[]) : null,
                    description: typeof parsed.updatedDescription === "string" ? parsed.updatedDescription : null,
                  };
                  const hasChanges = changes.title || (changes.bullets && changes.bullets.length > 0) || changes.description;
                  const msgs: Message[] = [{ role: "assistant", content: parsed.message }];
                  if (hasChanges) msgs.push({ role: "changes", content: "", changes });
                  return msgs;
                }
              } catch {
                // not JSON — show as plain text
              }
            }
            return [{ role: m.role as "user" | "assistant", content: m.content }];
          });
          setMessages(mapped);
          setConversationId(d.conversation.id);
          setHistoricalCount(mapped.filter((m) => m.role !== "changes").length);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [listingId]);

  // Proactive analysis: fires once per listing when history is empty
  useEffect(() => {
    if (loadingHistory) return;
    if (messages.length > 0) return;
    if (analyzedRef.current === listingId) return;
    analyzedRef.current = listingId;

    setMessages([{ role: "assistant", content: "", isTyping: true }]);
    fetch(`/api/agent/analyze?listingId=${listingId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.message) {
          setMessages([{ role: "assistant", content: d.message, isNew: true, isProactive: true }]);
        } else {
          setMessages([]);
        }
      })
      .catch(() => setMessages([]));
  }, [loadingHistory, listingId, messages.length]);

  const isFreeWithNoCredits = plan === "free" && credits === 0;

  const sendMessage = async () => {
    if (!input.trim() || loading || isFreeWithNoCredits) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: "Escribiendo...", isTyping: true },
    ]);
    setLoading(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, listingId, conversationId }),
        signal: controller.signal,
      });

      if (response.status === 403) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content: data.upsell
              ? "Has agotado tus consultas gratuitas.\n\n📦 Paquetes:\n• 20 consultas – 0,99 €\n• 50 consultas – 1,99 €\n• 100 consultas – 2,99 €\n• Plan Pro – 29 €/mes"
              : data.error ?? "Sin créditos disponibles.",
          },
        ]);
        return;
      }

      if (response.status === 429) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `⏳ ${data.error ?? "Demasiadas consultas. Espera un momento."}` },
        ]);
        return;
      }

      if (!response.ok || !response.body) throw new Error("Error en la consulta");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(frame.slice(6));

            if (data.error) {
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "assistant", content: `❌ ${data.error}` },
              ]);
            }

            if (data.done && data.parsed) {
              const msg =
                typeof data.parsed.message === "string"
                  ? data.parsed.message
                  : "Cambios procesados correctamente.";

              const p = data.parsed as Record<string, unknown>;
              const inventedSpecs = Array.isArray(p._inventedSpecs) ? (p._inventedSpecs as string[]) : null;
              const changes: Changes = {
                title: typeof p.updatedTitle === "string" ? p.updatedTitle : null,
                bullets: Array.isArray(p.updatedBullets) ? (p.updatedBullets as string[]) : null,
                description: typeof p.updatedDescription === "string" ? p.updatedDescription : null,
                _warning: inventedSpecs?.length
                  ? `Verifica antes de publicar: el agente añadió "${inventedSpecs.join('", "')}" — no aparece en tus atributos originales`
                  : null,
              };
              const hasChanges = changes.title || (changes.bullets && changes.bullets.length > 0) || changes.description;

              setMessages((prev) => {
                const withMsg: Message[] = [...prev.slice(0, -1), { role: "assistant", content: msg, isNew: true }];
                if (hasChanges) withMsg.push({ role: "changes", content: "", changes });
                return withMsg;
              });

              if (data.remainingCredits !== undefined) {
                setCredits(data.remainingCredits);
                if (typeof data.remainingCredits === "number") {
                  window.dispatchEvent(new CustomEvent("credits-update", { detail: { credits: data.remainingCredits } }));
                }
              }
              window.dispatchEvent(new Event("gamification-update"));
              if (data.conversationId) setConversationId(data.conversationId);
            }
          } catch {
            // Skip malformed SSE frames
          }
        }
      }
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: isAbort
            ? "⏱️ La IA tardó demasiado en responder. Inténtalo de nuevo."
            : "❌ Error al procesar la consulta. Inténtalo de nuevo.",
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const buyCredits = async (packId: string) => {
    try {
      const res = await fetch("/api/agent/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Error al abrir la página de pago.");
    }
  };

  if (!inline && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors z-50"
        title="Abrir Agente IA"
        aria-label="Abrir Agente IA"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className={inline
      ? "flex flex-col h-full bg-white rounded-2xl border border-gray-200"
      : "fixed bottom-6 right-6 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 flex flex-col"
    }>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-gray-900 text-sm">Agente IA</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Beta</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {plan !== "free" ? (
            <span className="text-purple-600 font-medium flex items-center gap-1">
              <Zap className="h-3 w-3" /> Pro
            </span>
          ) : (
            <span>💡 <span className="font-semibold text-blue-600">{credits}</span> consultas</span>
          )}
          {!inline && (
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 ml-1" aria-label="Cerrar chat">✕</button>
          )}
        </div>
      </div>

      {/* History bar */}
      {historicalCount > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 shrink-0">
          <span className="flex items-center gap-1.5 text-xs text-indigo-600">
            <History className="h-3 w-3" />
            {historicalCount} mensaje{historicalCount !== 1 ? "s" : ""} anterior{historicalCount !== 1 ? "es" : ""} cargado{historicalCount !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => { setMessages([]); setConversationId(null); setHistoricalCount(0); }}
            className="text-xs text-indigo-500 hover:text-indigo-800 font-medium transition-colors"
          >
            Nueva conversación
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {loadingHistory ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            <span className="text-xs">Cargando historial...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 pt-6">
            <Sparkles className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="font-medium text-sm">¡Hola! Soy tu asistente de copywriting.</p>
            <p className="text-xs mt-1 text-gray-400">
              Pídeme que mejore <strong>{productName}</strong> o usa una acción rápida.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            if (msg.role === "changes" && msg.changes) {
              return (
                <div key={i} className="flex justify-start">
                  <ChangeCard
                    changes={msg.changes}
                    listingId={listingId}
                    onSaved={onApplyChanges ? () => onApplyChanges(msg.changes!) : undefined}
                  />
                </div>
              );
            }
            return (
              <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {msg.isProactive && (
                  <div className="flex items-center gap-1 mb-1 px-1">
                    <Sparkles className="h-3 w-3 text-blue-400" />
                    <span className="text-xs text-blue-500 font-medium">Análisis automático</span>
                  </div>
                )}
                <div className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : msg.isTyping
                    ? "bg-gray-100 text-gray-400 flex items-center gap-1.5"
                    : msg.isProactive
                    ? "bg-blue-50 text-gray-800 border border-blue-100"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {msg.isTyping ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="text-xs">Analizando listing...</span></>
                  ) : msg.isNew ? (
                    <AnimatedText text={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Upsell panel */}
      {isFreeWithNoCredits && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 shrink-0">
          <p className="text-xs text-amber-800 font-medium mb-1.5">Sin consultas disponibles</p>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => buyCredits("pack_s")} className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded-full hover:bg-amber-700 transition-colors">20 consultas – 0,99 €</button>
            <button onClick={() => buyCredits("pack_m")} className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded-full hover:bg-amber-700 transition-colors">50 consultas – 1,99 €</button>
            <a href="/pricing" className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full hover:bg-blue-700 transition-colors">Plan Pro</a>
          </div>
        </div>
      )}

      {/* Quick actions — persistent scrollable row with fade hint */}
      {!isFreeWithNoCredits && (
        <div className="relative shrink-0">
          <div className="px-2.5 pt-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1.5 w-max pb-1">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => { setInput(a.command); inputRef.current?.focus(); }}
                  disabled={loading}
                  className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 px-2.5 py-1 rounded-full transition-colors whitespace-nowrap disabled:opacity-40"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          {/* Fade hint — indicates more chips to the right */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-2.5 bg-gray-50 rounded-b-2xl shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={isFreeWithNoCredits ? "Sin consultas disponibles" : "Escribe tu instrucción..."}
            disabled={loading || isFreeWithNoCredits}
            maxLength={500}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || isFreeWithNoCredits}
            className="bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:bg-blue-300 transition-colors shrink-0"
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
