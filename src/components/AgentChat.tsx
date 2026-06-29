"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Loader2, Zap, CheckCircle2, Copy, ChevronDown, ChevronUp, History, Save, Clock } from "lucide-react";

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

type OriginalContent = {
  title: string | null;
  bullets: string[] | null;
  description: string | null;
} | null;

interface Changes {
  title?: string | null;
  bullets?: string[] | null;
  description?: string | null;
  _warning?: string | null;
  _fromHistory?: boolean;
}

interface ClarificationOption {
  label: string;
  command: string;
}

interface Message {
  role: "user" | "assistant" | "changes";
  content: string;
  isTyping?: boolean;
  isNew?: boolean;
  isProactive?: boolean;
  isClarification?: boolean;
  clarificationOptions?: ClarificationOption[];
  timestamp?: number;
  changes?: Changes;
}

const QUICK_ACTIONS = [
  { label: "✂️ Acortar", command: "Acórtala a unas 100 palabras conservando los datos clave", seo: false },
  { label: "📏 Alargar", command: "Extiéndela con más detalle y beneficios, hasta unas 250 palabras", seo: false },
  { label: "💼 Formal", command: "Hazla más formal y profesional, tono corporativo", seo: false },
  { label: "⚡ Juvenil", command: "Hazla más juvenil, directa y fresca", seo: false },
  { label: "❤️ Emocional", command: "Hazla más emotiva, conectada al sentimiento del usuario", seo: false },
  { label: "🔧 Técnica", command: "Hazla más técnica, destacando especificaciones y datos concretos", seo: false },
  { label: "🎯 SEO", command: "", seo: true },
  { label: "🛡️ Confianza", command: "Añade elementos de confianza: garantías, certificaciones y casos de uso reales", seo: false },
];

const CLARIFICATION_OPTIONS: ClarificationOption[] = [
  { label: "✂️ Más corta", command: "Acórtala a unas 100 palabras conservando los datos clave" },
  { label: "📏 Más larga", command: "Extiéndela con más detalle y beneficios, hasta unas 250 palabras" },
  { label: "🎯 SEO", command: "Optimiza para SEO: inserta palabras clave en posiciones naturales" },
  { label: "💼 Más formal", command: "Hazla más formal y profesional, tono corporativo" },
  { label: "⚡ Más juvenil", command: "Hazla más juvenil, directa y fresca" },
  { label: "🔧 Más técnica", command: "Hazla más técnica, destacando especificaciones y datos concretos" },
  { label: "🛡️ Confianza", command: "Añade elementos de confianza: garantías, certificaciones y casos de uso reales" },
  { label: "⭐ Todo optimizado", command: "Optimiza el título, los bullets y la descripción para máxima conversión" },
];

const AMBIGUOUS_RE = /^(mejora|mejorar|cambiar|cambia|arreglar|arregla|mejor|editar|edita|optimiza|optimizar|reescribir|reescribe|hazlo|hazla|modificar|modifica|perfecciona|perfeccionar)\.?\s*$/i;

function isAmbiguousMessage(msg: string) {
  const trimmed = msg.trim();
  return AMBIGUOUS_RE.test(trimmed) || (trimmed.length < 10 && !/https?:/.test(trimmed));
}

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "Hace un momento";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}min`;
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

type SaveState = "idle" | "saving" | "saved" | "error";

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

function quickScore(changes: Changes): number | null {
  if (!changes.title && !changes.bullets && !changes.description) return null;
  let score = 0;
  if (changes.title) {
    const len = changes.title.length;
    if (len >= 60 && len <= 200) score += 15; else if (len >= 40) score += 8; else score += 5;
    if (!/[®©™%]/.test(changes.title)) score += 5;
    if ((changes.title.split(/[|·\-–—]/)[0]?.trim().length ?? 999) <= 45) score += 5;
  }
  if (changes.bullets?.length) {
    const count = changes.bullets.length;
    if (count >= 4 && count <= 7) score += 15; else score += 5;
    const formatted = changes.bullets.filter((b) => /^[A-ZÁÉÍÓÚÑ\s]{2,}:\s/.test(b));
    if (formatted.length === count) score += 20; else if (formatted.length > 0) score += 10;
  }
  if (changes.description) {
    const words = changes.description.trim().split(/\s+/).length;
    if (words >= 120 && words <= 280) score += 20; else if (words >= 80) score += 8;
    const isFormal = /^esta |^el diseño|^la composición|^este producto/i.test(changes.description.trim());
    if (/imagina|piensa en/i.test(changes.description) || isFormal) score += 10;
    if (/el resultado/i.test(changes.description)) score += 10;
  }
  return Math.min(100, score);
}

function ChangeCard({
  changes,
  listingId,
  onSaved,
  originalContent,
  timestamp,
  marketplace,
}: {
  changes: Changes;
  listingId: string;
  onSaved?: () => void;
  originalContent?: OriginalContent;
  timestamp?: number;
  marketplace?: string;
}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [bulletsExpanded, setBulletsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [view, setView] = useState<"new" | "original">("new");
  const [exportOpen, setExportOpen] = useState(false);

  const titleLimit = marketplace === "amazon_es" ? 200 : marketplace === "wallapop" ? 60 : marketplace === "etsy" ? 140 : 200;
  const score = quickScore(changes);

  const hasComparison =
    !changes._fromHistory &&
    originalContent &&
    (
      (changes.title && originalContent.title) ||
      (changes.bullets?.length && originalContent.bullets?.length) ||
      (changes.description && originalContent.description)
    );

  const isOriginalView = view === "original";
  const displayTitle = isOriginalView ? (originalContent?.title ?? null) : (changes.title ?? null);
  const displayBullets = isOriginalView ? (originalContent?.bullets ?? null) : (changes.bullets ?? null);
  const displayDescription = isOriginalView ? (originalContent?.description ?? null) : (changes.description ?? null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  // Optimistic save: flip to saved immediately, roll back on error
  const handleSave = async () => {
    setSaveState("saved");
    onSaved?.();
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
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const hasNew =
    (changes.title && changes.title.trim()) ||
    (changes.bullets && changes.bullets.length > 0) ||
    (changes.description && changes.description.trim());

  if (!hasNew) return null;

  const showTitle = isOriginalView ? !!displayTitle : !!(displayTitle?.trim());
  const showBullets = !!(displayBullets?.length);
  const showDescription = isOriginalView ? !!displayDescription : !!(displayDescription?.trim());

  const visibleBullets = bulletsExpanded
    ? displayBullets ?? []
    : (displayBullets ?? []).slice(0, 3);
  const hasMoreBullets = (displayBullets ?? []).length > 3;

  const descText = displayDescription ?? "";
  const descPreview = descText
    ? descExpanded ? descText : descText.slice(0, 180) + (descText.length > 180 ? "…" : "")
    : null;

  const labelColor = isOriginalView ? "text-gray-500" : "text-green-800";
  const itemBorder = isOriginalView ? "border-gray-100" : "border-green-100";
  const textColor = isOriginalView ? "text-gray-500" : "text-gray-800";
  const actionColor = isOriginalView ? "text-gray-400 hover:text-gray-600" : "text-green-700 hover:text-green-900";
  const bulletDot = isOriginalView ? "text-gray-300" : "text-green-500";

  return (
    <div className={`rounded-xl border ${isOriginalView ? "border-gray-200 bg-gray-50" : "border-green-200 bg-green-50"} overflow-hidden text-xs w-full max-w-[90%]`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-2 px-3 py-2 ${isOriginalView ? "bg-gray-400" : "bg-gradient-to-r from-green-500 to-emerald-500"}`}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
          <span className="text-white font-semibold text-xs">
            {isOriginalView ? "Versión original" : changes._fromHistory ? "Versión guardada" : "Cambios listos"}
          </span>
          {!isOriginalView && score !== null && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${score >= 85 ? "bg-white/30 text-white" : score >= 65 ? "bg-yellow-300/80 text-yellow-900" : "bg-red-300/80 text-red-900"}`}>
              {score}/100
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {timestamp && (
            <span className="text-white/70 text-xs flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {formatRelativeTime(timestamp)}
            </span>
          )}
          {!isOriginalView && !changes._fromHistory && (
            <button
              onClick={() => setExportOpen((p) => !p)}
              className="text-white/80 hover:text-white text-xs underline transition-colors"
              title="Exportar formato marketplace"
            >
              Exportar
            </button>
          )}
        </div>
      </div>

      {/* Export panel */}
      {exportOpen && !isOriginalView && (
        <div className="bg-gray-900 text-green-300 text-xs p-3 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
          {changes.title && `TÍTULO:\n${changes.title}\n\n`}
          {changes.bullets?.length && `BULLETS:\n${changes.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\n`}
          {changes.description && `DESCRIPCIÓN:\n${changes.description}`}
          <div className="mt-2 pt-2 border-t border-green-900">
            <button
              onClick={() => {
                const text = [
                  changes.title ? `TÍTULO:\n${changes.title}` : "",
                  changes.bullets?.length ? `BULLETS:\n${changes.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}` : "",
                  changes.description ? `DESCRIPCIÓN:\n${changes.description}` : "",
                ].filter(Boolean).join("\n\n");
                navigator.clipboard.writeText(text);
              }}
              className="text-green-400 hover:text-white transition-colors"
            >
              📋 Copiar todo
            </button>
          </div>
        </div>
      )}

      {/* Before/after tabs */}
      {hasComparison && (
        <div className="flex border-b border-gray-200 bg-white">
          <button
            onClick={() => setView("new")}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors focus:outline-none ${view === "new" ? "text-green-700 border-b-2 border-green-500" : "text-gray-400 hover:text-gray-600"}`}
          >
            Nuevo
          </button>
          <button
            onClick={() => setView("original")}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors focus:outline-none ${view === "original" ? "text-gray-700 border-b-2 border-gray-400" : "text-gray-400 hover:text-gray-600"}`}
          >
            Original
          </button>
        </div>
      )}

      <div className="p-3 space-y-2.5">
        {showTitle && displayTitle && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`font-semibold ${labelColor} uppercase tracking-wide`} style={{ fontSize: "10px" }}>Título</span>
              <button onClick={() => copyToClipboard(displayTitle, "title")} className={`flex items-center gap-1 ${actionColor} transition-colors`}>
                <Copy className="h-3 w-3" /><span>{copiedField === "title" ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <p className={`${textColor} leading-snug bg-white rounded-lg px-2.5 py-1.5 border ${itemBorder}`}>{displayTitle}</p>
            <span className={`text-xs mt-0.5 block ${!isOriginalView && displayTitle.length > titleLimit ? "text-red-500 font-medium" : !isOriginalView && displayTitle.length > titleLimit * 0.9 ? "text-amber-500" : "text-gray-400"}`}>
              {displayTitle.length} caracteres{!isOriginalView && displayTitle.length > titleLimit ? ` ⚠️ supera el límite de ${titleLimit}` : ""}
            </span>
          </div>
        )}

        {showBullets && displayBullets && displayBullets.length > 0 && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`font-semibold ${labelColor} uppercase tracking-wide`} style={{ fontSize: "10px" }}>Bullets ({displayBullets.length})</span>
              <button onClick={() => copyToClipboard(displayBullets.join("\n"), "bullets")} className={`flex items-center gap-1 ${actionColor} transition-colors`}>
                <Copy className="h-3 w-3" /><span>{copiedField === "bullets" ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <ul className="space-y-1">
              {visibleBullets.map((b, i) => (
                <li key={i} className={`flex items-start gap-1.5 bg-white rounded-lg px-2.5 py-1.5 border ${itemBorder}`}>
                  <span className={`${bulletDot} shrink-0 mt-0.5`}>•</span>
                  <span className={`${textColor} leading-snug`}>{b}</span>
                </li>
              ))}
            </ul>
            {hasMoreBullets && (
              <button
                onClick={() => setBulletsExpanded((v) => !v)}
                className={`mt-1 flex items-center gap-1 ${actionColor} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded`}
              >
                {bulletsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {bulletsExpanded ? "Ver menos" : `Ver ${displayBullets.length - 3} más`}
              </button>
            )}
          </div>
        )}

        {showDescription && descPreview && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`font-semibold ${labelColor} uppercase tracking-wide`} style={{ fontSize: "10px" }}>Descripción</span>
              <button onClick={() => copyToClipboard(descText, "description")} className={`flex items-center gap-1 ${actionColor} transition-colors`}>
                <Copy className="h-3 w-3" /><span>{copiedField === "description" ? "¡Copiado!" : "Copiar"}</span>
              </button>
            </div>
            <div className={`bg-white rounded-lg px-2.5 py-1.5 border ${itemBorder}`}>
              <p className={`${textColor} leading-snug whitespace-pre-wrap`}>{descPreview}</p>
              {descText.length > 180 && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className={`mt-1 flex items-center gap-1 ${actionColor} transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded`}
                >
                  {descExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {descExpanded ? "Ver menos" : "Ver más"}
                </button>
              )}
            </div>
          </div>
        )}

        {changes._warning && !isOriginalView && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-xs text-amber-800">
            <span className="shrink-0 text-sm">⚠️</span>
            <span>{changes._warning}</span>
          </div>
        )}

        {isOriginalView ? (
          <button
            onClick={() => setView("new")}
            className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            ← Ver versión nueva
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saveState === "saved"}
            className={`w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              saveState === "saved"
                ? "bg-green-700 text-white cursor-default"
                : saveState === "error"
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {saveState === "error" ? (
              "Error — inténtalo de nuevo"
            ) : saveState === "saved" ? (
              <><CheckCircle2 className="h-3 w-3" />Guardado en el producto</>
            ) : (
              <><Save className="h-3 w-3" />{changes._fromHistory ? "Restaurar esta versión" : "Guardar en el producto"}</>
            )}
          </button>
        )}
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
  const [initialContent, setInitialContent] = useState<OriginalContent>(null);
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [seoKeyword, setSeoKeyword] = useState("");
  const [showHistoryOnly, setShowHistoryOnly] = useState(false);
  const [marketplace, setMarketplace] = useState("generico");
  const [missingAttrs, setMissingAttrs] = useState<string[]>([]);
  const [supplementalAttrs, setSupplementalAttrs] = useState<Record<string, string>>({});
  const [attrPanelOpen, setAttrPanelOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seoInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const analyzedRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/agent/credits/status")
      .then((r) => r.json())
      .then((d) => { setCredits(d.credits ?? 0); setPlan(d.plan ?? "free"); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    setConversationId(null);
    setHistoricalCount(0);
    setInitialContent(null);
    setShowHistoryOnly(false);
    setLoadingHistory(true);

    fetch(`/api/agent/conversation?listingId=${listingId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.conversation) {
          const stored = d.conversation.messages as { role: string; content: string; timestamp?: number }[];
          const mapped: Message[] = stored.flatMap((m) => {
            if (m.role === "assistant") {
              try {
                const parsed = JSON.parse(m.content) as Record<string, unknown>;
                if (parsed && typeof parsed.message === "string") {
                  const changes: Changes = {
                    title: typeof parsed.updatedTitle === "string" ? parsed.updatedTitle : null,
                    bullets: Array.isArray(parsed.updatedBullets) ? (parsed.updatedBullets as string[]) : null,
                    description: typeof parsed.updatedDescription === "string" ? parsed.updatedDescription : null,
                    _fromHistory: true,
                  };
                  const hasChanges = changes.title || (changes.bullets && changes.bullets.length > 0) || changes.description;
                  const msgs: Message[] = [{ role: "assistant", content: parsed.message, timestamp: m.timestamp }];
                  if (hasChanges) msgs.push({ role: "changes", content: "", changes, timestamp: m.timestamp });
                  return msgs;
                }
              } catch {
                // plain text fallback
              }
            }
            return [{ role: m.role as "user" | "assistant", content: m.content, timestamp: m.timestamp }];
          });
          setMessages(mapped);
          setConversationId(d.conversation.id);
          setHistoricalCount(mapped.filter((m) => m.role !== "changes").length);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [listingId]);

  // Proactive analysis when history is empty
  useEffect(() => {
    if (loadingHistory) return;
    if (messages.length > 0) return;
    if (analyzedRef.current === listingId) return;
    analyzedRef.current = listingId;

    setMessages([{ role: "assistant", content: "", isTyping: true }]);
    fetch(`/api/agent/analyze?listingId=${listingId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.current) setInitialContent(d.current as OriginalContent);
        if (Array.isArray(d.missingAttrs) && d.missingAttrs.length > 0) {
          setMissingAttrs(d.missingAttrs);
          setAttrPanelOpen(true);
        }
        if (d.message) {
          setMessages([{ role: "assistant", content: d.message, isNew: true, isProactive: true }]);
        } else {
          setMessages([]);
        }
      })
      .catch(() => setMessages([]));
  }, [loadingHistory, listingId, messages.length]);

  useEffect(() => {
    if (seoModalOpen) setTimeout(() => seoInputRef.current?.focus(), 50);
  }, [seoModalOpen]);

  const isFreeWithNoCredits = plan === "free" && credits === 0;

  const applySeoKeyword = () => {
    if (!seoKeyword.trim()) return;
    setInput(`Optimiza para SEO: inserta "${seoKeyword.trim()}" como keyword principal en el título, primer bullet y primer párrafo en posiciones naturales`);
    setSeoKeyword("");
    setSeoModalOpen(false);
    inputRef.current?.focus();
  };

  const sendMessage = async (overrideMessage?: string) => {
    const userMessage = overrideMessage ?? input.trim();
    if (!userMessage || loading || isFreeWithNoCredits) return;

    // Ambiguity detection — only for user-typed messages, not chip commands
    if (!overrideMessage && isAmbiguousMessage(userMessage)) {
      setInput("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        {
          role: "assistant",
          content: "Para ayudarte mejor, ¿qué quieres hacer exactamente?",
          isClarification: true,
          clarificationOptions: CLARIFICATION_OPTIONS,
        },
      ]);
      return;
    }

    if (!overrideMessage) setInput("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    setMessages((prev) => {
      // Remove trailing clarification messages before appending new exchange
      const cleaned = prev.filter((m) => !m.isClarification);
      return [
        ...cleaned,
        { role: "user", content: userMessage },
        { role: "assistant", content: "Escribiendo...", isTyping: true },
      ];
    });
    setLoading(true);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, listingId, conversationId, marketplace, supplementalAttrs }),
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
              const msg = typeof data.parsed.message === "string"
                ? data.parsed.message
                : "Cambios procesados correctamente.";

              const p = data.parsed as Record<string, unknown>;
              const inventedSpecs = Array.isArray(p._inventedSpecs) ? (p._inventedSpecs as string[]) : null;
              const now = Math.floor(Date.now() / 1000);
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
                const withMsg: Message[] = [...prev.slice(0, -1), { role: "assistant", content: msg, isNew: true, timestamp: now }];
                if (hasChanges) withMsg.push({ role: "changes", content: "", changes, timestamp: now });
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
            // skip malformed frames
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

  const historyVersions = messages.filter((m) => m.role === "changes" && m.changes);
  const displayMessages = showHistoryOnly ? messages.filter((m) => m.role === "changes") : messages;

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
          <select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white text-gray-600 cursor-pointer"
          >
            <option value="generico">🛒 Genérico</option>
            <option value="amazon_es">📦 Amazon ES</option>
            <option value="etsy">🎨 Etsy</option>
            <option value="shopify">🛍️ Shopify</option>
            <option value="wallapop">💬 Wallapop</option>
          </select>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {plan !== "free" ? (
            <span className="text-purple-600 font-medium flex items-center gap-1">
              <Zap className="h-3 w-3" /> Pro
            </span>
          ) : (
            <span>💡 <span className="font-semibold text-blue-600">{credits}</span> consultas</span>
          )}
          {/* Version history toggle */}
          {historyVersions.length > 0 && (
            <button
              onClick={() => setShowHistoryOnly((v) => !v)}
              title={showHistoryOnly ? "Ver conversación completa" : "Ver versiones guardadas"}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors ${
                showHistoryOnly
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              <Clock className="h-3 w-3" />
              <span>{historyVersions.length}</span>
            </button>
          )}
          {!inline && (
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 ml-1" aria-label="Cerrar chat">✕</button>
          )}
        </div>
      </div>

      {/* History bar */}
      {historicalCount > 0 && !showHistoryOnly && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border-b border-indigo-100 shrink-0">
          <span className="flex items-center gap-1.5 text-xs text-indigo-600">
            <History className="h-3 w-3" />
            {historicalCount} mensaje{historicalCount !== 1 ? "s" : ""} anterior{historicalCount !== 1 ? "es" : ""} cargado{historicalCount !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => { setMessages([]); setConversationId(null); setHistoricalCount(0); analyzedRef.current = null; }}
            className="text-xs text-indigo-500 hover:text-indigo-800 font-medium transition-colors"
          >
            Nueva conversación
          </button>
        </div>
      )}

      {/* History-only mode banner */}
      {showHistoryOnly && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-600 shrink-0">
          <span className="text-xs text-white font-medium flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {historyVersions.length} versión{historyVersions.length !== 1 ? "es" : ""} guardada{historyVersions.length !== 1 ? "s" : ""}
          </span>
          <button onClick={() => setShowHistoryOnly(false)} className="text-xs text-indigo-200 hover:text-white transition-colors">
            Ver conversación →
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
        ) : showHistoryOnly ? (
          historyVersions.length === 0 ? (
            <div className="text-center text-gray-400 pt-6 text-xs">Sin versiones guardadas aún</div>
          ) : (
            <div className="space-y-4">
              {historyVersions.map((msg, i) => (
                <div key={i}>
                  {msg.timestamp && (
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {formatRelativeTime(msg.timestamp)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}
                  <div className="flex justify-start">
                    <ChangeCard
                      changes={msg.changes!}
                      listingId={listingId}
                      originalContent={msg.changes?._fromHistory ? null : initialContent}
                      timestamp={undefined}
                      marketplace={marketplace}
                      onSaved={onApplyChanges ? () => onApplyChanges(msg.changes!) : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : displayMessages.length === 0 ? (
          <div className="text-center text-gray-500 pt-6">
            <Sparkles className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="font-medium text-sm">¡Hola! Soy tu asistente de copywriting.</p>
            <p className="text-xs mt-1 text-gray-400">
              Pídeme que mejore <strong>{productName}</strong> o usa una acción rápida.
            </p>
          </div>
        ) : (
          displayMessages.map((msg, i) => {
            if (msg.role === "changes" && msg.changes) {
              return (
                <div key={i} className="flex justify-start">
                  <ChangeCard
                    changes={msg.changes}
                    listingId={listingId}
                    originalContent={msg.changes._fromHistory ? null : initialContent}
                    timestamp={msg.timestamp}
                    marketplace={marketplace}
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
                    : msg.isClarification
                    ? "bg-orange-50 text-gray-800 border border-orange-100 w-full max-w-full"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {msg.isTyping ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="text-xs">Analizando listing...</span></>
                  ) : msg.isNew ? (
                    <AnimatedText text={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                  {/* Clarification chips */}
                  {msg.isClarification && msg.clarificationOptions && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {msg.clarificationOptions.map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => sendMessage(opt.command)}
                          disabled={loading}
                          className="text-xs bg-orange-100 text-orange-800 border border-orange-200 px-2.5 py-1 rounded-full hover:bg-orange-200 transition-colors disabled:opacity-40"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
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

      {/* Quick actions */}
      {!isFreeWithNoCredits && !showHistoryOnly && (
        <div className="relative shrink-0">
          <div className="px-2.5 pt-2 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1.5 w-max pb-1">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => {
                    if (a.seo) {
                      setSeoModalOpen((prev) => !prev);
                    } else {
                      setInput(a.command);
                      setSeoModalOpen(false);
                      inputRef.current?.focus();
                    }
                  }}
                  disabled={loading}
                  className={`text-xs border px-2.5 py-1 rounded-full transition-colors whitespace-nowrap disabled:opacity-40 ${
                    a.seo && seoModalOpen
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-100 hover:bg-blue-50 hover:text-blue-700 border-gray-200 hover:border-blue-200"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
      )}

      {/* SEO keyword confirm */}
      {seoModalOpen && !isFreeWithNoCredits && (
        <div className="px-3 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2 shrink-0">
          <span className="text-xs text-blue-700 shrink-0 font-medium">Keyword:</span>
          <input
            ref={seoInputRef}
            type="text"
            value={seoKeyword}
            onChange={(e) => setSeoKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySeoKeyword();
              if (e.key === "Escape") { setSeoModalOpen(false); setSeoKeyword(""); }
            }}
            placeholder="ej: auriculares bluetooth inalámbricos"
            className="flex-1 text-xs border border-blue-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          <button
            onClick={applySeoKeyword}
            disabled={!seoKeyword.trim()}
            className="text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 shrink-0 transition-colors"
          >
            Aplicar
          </button>
          <button
            onClick={() => { setSeoModalOpen(false); setSeoKeyword(""); }}
            className="text-gray-400 hover:text-gray-600 shrink-0 text-sm"
            aria-label="Cerrar"
          >✕</button>
        </div>
      )}

      {/* Attribute enrichment panel */}
      {missingAttrs.length > 0 && !showHistoryOnly && (
        <div className="border-t border-amber-200 bg-amber-50 shrink-0">
          <button
            onClick={() => setAttrPanelOpen((p) => !p)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <span>💡 Añade datos para un copy más preciso ({missingAttrs.length} campos)</span>
            <span className="text-amber-600">{attrPanelOpen ? "▲" : "▼"}</span>
          </button>
          {attrPanelOpen && (
            <div className="px-3 pb-3 space-y-2">
              {missingAttrs.map((attr) => {
                const key = attr.replace(/\s+/g, "_");
                const placeholders: Record<string, string> = {
                  "composición_del_material": "ej: 80% algodón, 20% poliéster",
                  "color_disponible": "ej: negro, blanco, azul marino",
                  "talla_o_medidas": "ej: S, M, L, XL / 30x40cm",
                  "instrucciones_de_cuidado": "ej: lavar a 30°, no centrifugar",
                };
                return (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-xs text-amber-700 w-32 shrink-0 capitalize">{attr}:</label>
                    <input
                      type="text"
                      value={supplementalAttrs[key] ?? ""}
                      onChange={(e) => setSupplementalAttrs((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholders[key] ?? ""}
                      className="flex-1 text-xs border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                    />
                  </div>
                );
              })}
              <p className="text-xs text-amber-600 mt-1">Estos datos se usarán en tus próximas generaciones — no modifican la ficha del producto.</p>
            </div>
          )}
        </div>
      )}

      {/* Input — hidden in history-only mode */}
      {!showHistoryOnly && (
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
              onClick={() => sendMessage()}
              disabled={loading || !input.trim() || isFreeWithNoCredits}
              className="bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700 disabled:bg-blue-300 transition-colors shrink-0"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
