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
  formal: "Formal",
  informal: "Informal",
  witty: "Ingenioso",
  professional: "Profesional",
  emotional: "Emocional",
  technical: "Técnico",
};

const VOCAB_LABELS: Record<string, string> = {
  simple: "Simple",
  sophisticated: "Sofisticado",
  technical: "Técnico",
  playful: "Lúdico",
  balanced: "Equilibrado",
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
    } catch {
      // silent
    } finally {
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

  const removeExample = (i: number) => {
    setExamples((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleAnalyze = async () => {
    if (examples.length < 3) {
      setError("Necesitas al menos 3 ejemplos para crear un perfil.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/voice-profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examples, name: profileName || "Mi perfil de voz" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Error al analizar. Inténtalo de nuevo.");
        return;
      }
      setExamples([]);
      setCurrentExample("");
      setProfileName("");
      setShowForm(false);
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
    } catch {
      // silent
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este perfil de voz?")) return;
    try {
      await fetch(`/api/voice-profile/${id}`, { method: "DELETE" });
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // silent
    }
  };

  return (
    <div className="bg-white rounded-lg border">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Perfil de voz</span>
          {activeProfile ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
              {activeProfile.name}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              Sin perfil activo
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 py-2">Cargando perfiles...</p>
          ) : (
            <>
              {profiles.length > 0 && (
                <div className="space-y-2">
                  {profiles.map((p) => {
                    const pd = p.profile as VoiceProfileData;
                    return (
                      <div
                        key={p.id}
                        className={`rounded-lg border p-3 ${
                          p.isActive ? "border-purple-300 bg-purple-50" : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-gray-900">{p.name}</span>
                              {p.isActive === 1 && (
                                <span className="text-xs text-purple-600 font-medium">Activo</span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {pd.tone && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  {TONE_LABELS[pd.tone] ?? pd.tone}
                                </span>
                              )}
                              {pd.vocabulary && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  {VOCAB_LABELS[pd.vocabulary] ?? pd.vocabulary}
                                </span>
                              )}
                              {pd.keyWords?.slice(0, 3).map((kw) => (
                                <span key={kw} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                  {kw}
                                </span>
                              ))}
                            </div>
                            {pd.brandPersonality && (
                              <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                                {pd.brandPersonality}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleToggle(p.id)}
                              className={`text-xs px-2 py-1 rounded transition-colors ${
                                p.isActive
                                  ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  : "bg-purple-600 text-white hover:bg-purple-700"
                              }`}
                            >
                              {p.isActive ? "Desactivar" : "Activar"}
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {profiles.length === 0 && !showForm && (
                <p className="text-sm text-gray-500 py-1">
                  Aún no tienes perfiles de voz. Crea uno para que la IA escriba con el estilo de tu marca.
                </p>
              )}

              {showForm ? (
                <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Añade 3–10 ejemplos de descripciones que te gusten. La IA analizará el estilo de escritura de tu marca.
                  </p>

                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Nombre del perfil (ej. Marca de moda)"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    maxLength={80}
                  />

                  <div className="flex gap-2">
                    <textarea
                      value={currentExample}
                      onChange={(e) => setCurrentExample(e.target.value)}
                      placeholder="Pega una descripción de producto que te guste..."
                      className="flex-1 border rounded-lg px-3 py-2 text-sm h-16 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                      maxLength={800}
                    />
                    <button
                      onClick={addExample}
                      disabled={!currentExample.trim() || examples.length >= 10}
                      className="px-3 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 disabled:bg-gray-300 transition-colors self-start"
                    >
                      Añadir
                    </button>
                  </div>

                  {examples.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-600">
                        {examples.length} ejemplo{examples.length !== 1 ? "s" : ""} añadido{examples.length !== 1 ? "s" : ""}
                        {examples.length < 3 && (
                          <span className="text-orange-500 ml-1">(mínimo 3)</span>
                        )}
                      </p>
                      {examples.map((ex, i) => (
                        <div key={i} className="flex items-start gap-2 bg-white border rounded p-2">
                          <span className="text-xs text-gray-400 shrink-0 mt-0.5">{i + 1}.</span>
                          <p className="text-xs text-gray-700 flex-1 line-clamp-2">{ex}</p>
                          <button
                            onClick={() => removeExample(i)}
                            className="text-red-400 hover:text-red-600 shrink-0 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {error && <p className="text-xs text-red-600">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing || examples.length < 3}
                      className="flex-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
                    >
                      {analyzing ? "Analizando..." : "Crear perfil de voz"}
                    </button>
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setError(null);
                        setExamples([]);
                        setCurrentExample("");
                      }}
                      className="px-3 py-2 border text-sm rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
                >
                  + Crear nuevo perfil
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
