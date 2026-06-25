"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, Zap, CheckCircle2, Copy, ChevronDown, ChevronUp } from "lucide-react";

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
}

interface Message {
  role: "user" | "assistant" | "changes";
  content: string;
  isTyping?: boolean;
  changes?: Changes;
}

const QUICK_ACTIONS = [
  { label: "Acortar", command: "Acórtala a 100 palabras" },
  { label: "Hacer formal", command: "Hazla más formal y profesional" },
  { label: "Añadir SEO", command: "Añade palabras clave SEO relevantes" },
  { label: "Hacer juvenil", command: "Hazla más juvenil y fresca" },
];

function ChangeCard({ changes }: { changes: Changes }) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [bulletsExpanded, setBulletsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
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
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
        <span className="text-white font-semibold text-xs">Cambios aplicados</span>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Title */}
        {changes.title && changes.title.trim() && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-green-800 uppercase tracking-wide" style={{ fontSize: "10px" }}>
                Título
              </span>
              <button
                onClick={() => copyToClipboard(changes.title!, "title")}
                className="flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors"
              >
                <Copy className="h-3 w-3" />
                <span>{copiedField === "title" ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <p className="text-gray-800 leading-snug bg-white rounded-lg px-2.5 py-1.5 border border-green-100">
              {changes.title}
            </p>
          </div>
        )}

        {/* Bullets */}
        {changes.bullets && changes.bullets.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-green-800 uppercase tracking-wide" style={{ fontSize: "10px" }}>
                Bullets ({changes.bullets.length})
              </span>
              <button
                onClick={() => copyToClipboard(changes.bullets!.join("\n"), "bullets")}
                className="flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors"
              >
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
                className="mt-1 flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors"
              >
                {bulletsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {bulletsExpanded ? "Ver menos" : `Ver ${changes.bullets.length - 3} más`}
              </button>
            )}
          </div>
        )}

        {/* Description */}
        {changes.description && changes.description.trim() && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-semibold text-green-800 uppercase tracking-wide" style={{ fontSize: "10px" }}>
                Descripción
              </span>
              <button
                onClick={() => copyToClipboard(changes.description!, "description")}
                className="flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors"
              >
                <Copy className="h-3 w-3" />
                <span>{copiedField === "description" ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <div className="bg-white rounded-lg px-2.5 py-1.5 border border-green-100">
              <p className="text-gray-800 leading-snug whitespace-pre-wrap">{descPreview}</p>
              {changes.description.length > 180 && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-1 flex items-center gap-1 text-green-700 hover:text-green-900 transition-colors"
                >
                  {descExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {descExpanded ? "Ver menos" : "Ver más"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentChat({ listingId, productName, inline = false, onApplyChanges }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState<number | "ilimitado">(0);
  const [plan, setPlan] = useState("free");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [listingId]);

  const isFreeWithNoCredits = plan === "free" && credits === 0;

  const sendMessage = async () => {
    if (!input.trim() || loading || isFreeWithNoCredits) return;

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

      if (!response.ok || !response.body) {
        throw new Error("Error en la consulta");
      }

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
              const changes: Changes = {
                title: typeof p.updatedTitle === "string" ? p.updatedTitle : null,
                bullets: Array.isArray(p.updatedBullets) ? (p.updatedBullets as string[]) : null,
                description: typeof p.updatedDescription === "string" ? p.updatedDescription : null,
              };

              const hasChanges = changes.title || (changes.bullets && changes.bullets.length > 0) || changes.description;

              // Replace typing indicator with text message, then optionally add change card
              setMessages((prev) => {
                const withMsg: Message[] = [...prev.slice(0, -1), { role: "assistant", content: msg }];
                if (hasChanges) {
                  withMsg.push({ role: "changes", content: "", changes });
                }
                return withMsg;
              });

              if (data.remainingCredits !== undefined) setCredits(data.remainingCredits);
              if (data.conversationId) setConversationId(data.conversationId);

              if (onApplyChanges && hasChanges) {
                onApplyChanges(changes);
              }
            }
          } catch {
            // Skip malformed SSE frames
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "❌ Error al procesar la consulta. Inténtalo de nuevo." },
      ]);
    } finally {
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
            <span>
              💡 <span className="font-semibold text-blue-600">{credits}</span> consultas
            </span>
          )}
          {!inline && (
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 ml-1"
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 pt-6">
            <Sparkles className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="font-medium text-sm">¡Hola! Soy tu asistente de copywriting.</p>
            <p className="text-xs mt-1 text-gray-400">
              Pídeme que mejore <strong>{productName}</strong>.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => {
                    setInput(a.command);
                    inputRef.current?.focus();
                  }}
                  className="text-xs bg-gray-100 hover:bg-gray-200 px-2.5 py-1 rounded-full transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            if (msg.role === "changes" && msg.changes) {
              return (
                <div key={i} className="flex justify-start">
                  <ChangeCard changes={msg.changes} />
                </div>
              );
            }
            return (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : msg.isTyping
                      ? "bg-gray-100 text-gray-400 flex items-center gap-1.5"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {msg.isTyping ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs">IA escribiendo...</span>
                    </>
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

      {/* Upsell panel when out of credits */}
      {isFreeWithNoCredits && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 shrink-0">
          <p className="text-xs text-amber-800 font-medium mb-1.5">Sin consultas disponibles</p>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => buyCredits("pack_s")}
              className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded-full hover:bg-amber-700 transition-colors"
            >
              20 consultas – 0,99 €
            </button>
            <button
              onClick={() => buyCredits("pack_m")}
              className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded-full hover:bg-amber-700 transition-colors"
            >
              50 consultas – 1,99 €
            </button>
            <a
              href="/pricing"
              className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-full hover:bg-blue-700 transition-colors"
            >
              Plan Pro
            </a>
          </div>
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
            placeholder={isFreeWithNoCredits ? "Sin consultas disponibles" : "Escribe tu mensaje..."}
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
