"use client";

import { useState, useEffect, useCallback } from "react";

interface VoiceProfileData {
  tone: string;
  vocabulary: string;
  sentenceStructure: string;
  keyWords: string[];
  brandPersonality: string;
  suggestions: string[];
}

interface VoiceProfile {
  id: string;
  name: string;
  profile: VoiceProfileData;
  isActive: number;
  createdAt: number;
}

const TONE_LABELS: Record<string, string> = {
  formal: "Formal", informal: "Informal", witty: "Ingenioso",
  professional: "Profesional", emotional: "Emocional", technical: "Técnico",
};

const VOCAB_LABELS: Record<string, string> = {
  simple: "Simple", sophisticated: "Sofisticado", technical: "Técnico",
  playful: "Lúdico", balanced: "Equilibrado",
};

export default function VoiceProfileManager() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [currentExample, setCurrentExample] = useState("");

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/voice-profile");
      const data = await res.json();
      if (data.profiles) setProfiles(data.profiles);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchProfiles();
  }, [isOpen, fetchProfiles]);

  const activeProfile = profiles.find((p) => p.isActive === 1);

  const addExample = () => {
    const trimmed = currentExample.trim();
    if (!trimmed || examples.length >= 10) return;
    setExamples((prev) => [...prev, trimmed]);
    setCurrentExample("");
  };

  const handleAnalyze = async () => {
    if (examples.length < 3) { setError("Necesitas al menos 3 ejemplos."); return; }
    setError(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/voice-profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examples, name: profileName || "Mi perfil de voz" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error ?? "Error al analizar."); return; }
      setExamples([]); setCurrentExample(""); setProfileName(""); setShowForm(false);
      await fetchProfiles();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await fetch(`/api/voice-profile/${id}`, { method: "PATCH" });
      await fetchProfiles();
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este perfil de voz?")) return;
    try {
      await fetch(`/api/voice-profile/${id}`, { method: "DELETE" });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch { /* silent */ }
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/40 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">🎙️</span>
          <span className="text-sm font-semibold text-gray-800">Perfil de Voz</span>
          <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">Nuevo</span>
          {activeProfile ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
              {activeProfile.name}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/60 text-gray-500 border border-gray-200">
              Sin perfil activo
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-purple-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t border-purple-100 px-4 pb-4 pt-3 space-y-3 bg-white/60">
          {/* Explanation */}
          <p className="text-xs text-gray-600 leading-relaxed">
            El perfil de voz aprende el estilo de escritura de tu marca a partir de descripciones de ejemplo.
            Una vez activo, <span className="font-medium text-purple-700">todas las generaciones adoptarán automáticamente ese tono y vocabulario.</span>
          </p>

          {loading ? (
            <p className="text-sm text-gray-500 py-2">Cargando perfiles...</p>
          ) : (
            <>
              {/* Active profile card */}
              {activeProfile && (
                <div className="bg-white rounded-xl border border-purple-200 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{activeProfile.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {(activeProfile.profile as VoiceProfileData).brandPersonality}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Activo</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(activeProfile.profile as VoiceProfileData).tone && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                        {TONE_LABELS[(activeProfile.profile as VoiceProfileData).tone] ?? (activeProfile.profile as VoiceProfileData).tone}
                      </span>
                    )}
                    {(activeProfile.profile as VoiceProfileData).vocabulary && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {VOCAB_LABELS[(activeProfile.profile as VoiceProfileData).vocabulary] ?? (activeProfile.profile as VoiceProfileData).vocabulary}
                      </span>
                    )}
                    {(activeProfile.profile as VoiceProfileData).keyWords?.slice(0, 3).map((kw) => (
                      <span key={kw} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Other profiles list */}
              {profiles.filter((p) => p.isActive === 0).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Otros perfiles</p>
                  {profiles.filter((p) => p.isActive === 0).map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
                      <span className="text-xs text-gray-700 font-medium truncate">{p.name}</span>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleToggle(p.id)}
                          className="text-xs px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                        >
                          Activar
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {profiles.length === 0 && !showForm && (
                <div className="bg-white rounded-lg border border-dashed border-purple-300 p-4 text-center">
                  <p className="text-sm text-gray-600">Aún no tienes perfiles de voz.</p>
                  <p className="text-xs text-gray-400 mt-0.5">Añade 3 descripciones de ejemplo para crear el primero.</p>
                </div>
              )}

              {/* Deactivate active profile button */}
              {activeProfile && !showForm && (
                <button
                  onClick={() => handleToggle(activeProfile.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Desactivar perfil actual
                </button>
              )}

              {/* New profile form */}
              {showForm ? (
                <div className="space-y-3 border border-purple-200 rounded-xl p-3 bg-white">
                  <p className="text-xs text-gray-500">
                    Añade 3–10 descripciones reales de productos que representen el estilo de tu marca.
                  </p>

                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Nombre del perfil (ej. Marca de moda)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    maxLength={80}
                  />

                  <div className="flex gap-2">
                    <textarea
                      value={currentExample}
                      onChange={(e) => setCurrentExample(e.target.value)}
                      placeholder="Pega una descripción de producto que te guste..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      maxLength={800}
                    />
                    <button
                      onClick={addExample}
                      disabled={!currentExample.trim() || examples.length >= 10}
                      className="px-3 py-2 bg-gray-700 text-white text-xs rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition-colors self-start"
                    >
                      Añadir
                    </button>
                  </div>

                  {/* Progress indicator */}
                  {examples.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-600">
                          {examples.length} ejemplo{examples.length !== 1 ? "s" : ""}
                          {examples.length < 3 && <span className="text-orange-500 ml-1">(mínimo 3)</span>}
                        </p>
                        <p className="text-xs text-gray-400">{Math.min(Math.round((examples.length / 5) * 100), 100)}%</p>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full transition-all"
                          style={{ width: `${Math.min((examples.length / 5) * 100, 100)}%` }}
                        />
                      </div>
                      <div className="space-y-1">
                        {examples.map((ex, i) => (
                          <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                            <span className="text-xs text-gray-400 shrink-0 mt-0.5">{i + 1}.</span>
                            <p className="text-xs text-gray-700 flex-1 line-clamp-1">{ex}</p>
                            <button
                              onClick={() => setExamples((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-red-400 hover:text-red-600 shrink-0 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing || examples.length < 3}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors font-medium"
                    >
                      {analyzing ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Analizando...
                        </span>
                      ) : "Crear perfil de voz"}
                    </button>
                    <button
                      onClick={() => { setShowForm(false); setError(null); setExamples([]); setCurrentExample(""); }}
                      className="px-3 py-2 border text-sm rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors flex items-center gap-1"
                >
                  <span>+</span> Crear nuevo perfil
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
