"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, Zap } from "lucide-react";

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

interface Message {
  role: "user" | "assistant";
  content: string;
  isTyping?: boolean;
}

const QUICK_ACTIONS = [
  { label: "Acortar", command: "Acórtala a 100 palabras" },
  { label: "Hacer formal", command: "Hazla más formal y profesional" },
  { label: "Añadir SEO", command: "Añade palabras clave SEO relevantes" },
  { label: "Hacer juvenil", command: "Hazla más juvenil y fresca" },
];

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

  // Reset conversation when product changes
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

      // Read SSE stream — typing indicator stays until done event
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
                  : "Cambios aplicados correctamente.";

              // Replace typing indicator with the actual AI message
              setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: msg }]);

              if (data.remainingCredits !== undefined) setCredits(data.remainingCredits);
              if (data.conversationId) setConversationId(data.conversationId);

              // Apply content changes to LivePreview via callback
              if (onApplyChanges) {
                const p = data.parsed as Record<string, unknown>;
                onApplyChanges({
                  title: typeof p.updatedTitle === "string" ? p.updatedTitle : null,
                  bullets: Array.isArray(p.updatedBullets) ? (p.updatedBullets as string[]) : null,
                  description: typeof p.updatedDescription === "string" ? p.updatedDescription : null,
                });
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
          messages.map((msg, i) => (
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
          ))
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
