"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";

interface Props {
  onClose: () => void;
}

export default function SupportContactModal({ onClose }: Props) {
  const { user } = useUser();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (message.trim().length < 10) {
      setError("Cuéntanos un poco más — mínimo 10 caracteres.");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo enviar el mensaje.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        {status === "sent" ? (
          <>
            <p className="text-lg font-bold text-gray-900">✅ Mensaje enviado</p>
            <p className="text-sm text-gray-600">Te responderemos en menos de 24h a tu email registrado.</p>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-gray-900">Contactar soporte</h3>
            <p className="text-xs text-gray-500">
              Enviando como {user?.fullName || user?.username || "tu cuenta"}
              {user?.primaryEmailAddress ? ` (${user.primaryEmailAddress.emailAddress})` : ""}. Te responderemos a ese email.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Cuéntanos en qué podemos ayudarte..."
              rows={5}
              maxLength={2000}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={status === "sending"}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {status === "sending" ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
