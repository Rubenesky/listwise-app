import VoiceProfileManager from "@/components/VoiceProfileManager";

export default function VoiceProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">🎙️ Perfil de Voz</h1>
        <p className="mt-1 text-sm text-gray-600">
          Define el tono, vocabulario y personalidad de tu marca para que la IA genere copy coherente con tu identidad.
        </p>
      </div>
      <VoiceProfileManager />
    </div>
  );
}
