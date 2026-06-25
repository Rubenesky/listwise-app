"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ADMIN_USER_IDS = ["user_3FKeQMYvlFqlnt1QqG8pURl1ARl"];

interface AnalyticsData {
  total: number;
  accepted: number;
  acceptanceRate: number;
  avgLatency: number;
  commands: { name: string; count: number; percentage: number }[];
  products: { id: string; name: string; count: number; percentage: number }[];
  evolution: { date: string; count: number }[];
}

export default function AdminAnalyticsPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }
    if (user?.id && !ADMIN_USER_IDS.includes(user.id)) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (!isSignedIn || !user?.id || !ADMIN_USER_IDS.includes(user.id)) return;

    fetch("/api/admin/agent-analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isSignedIn, user]);

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">No hay datos disponibles.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">📊 Analítica — Agent Mode</h1>
      <p className="text-sm text-gray-500 mb-6">Últimas 1.000 consultas</p>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total consultas", value: data.total, color: "text-gray-900" },
          { label: "Aceptadas", value: data.accepted, color: "text-green-600" },
          { label: "Tasa aceptación", value: `${data.acceptanceRate.toFixed(1)}%`, color: "text-blue-600" },
          { label: "Latencia media", value: `${data.avgLatency.toFixed(0)} ms`, color: "text-gray-900" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-lg border p-4 text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Commands */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">📊 Comandos más usados</h2>
        {data.commands.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos aún.</p>
        ) : (
          <div className="space-y-3">
            {data.commands.map((cmd) => (
              <div key={cmd.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium capitalize">{cmd.name}</span>
                  <span className="text-gray-500">
                    {cmd.count} ({cmd.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(cmd.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top products */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">🔍 Productos más consultados</h2>
        {data.products.length === 0 ? (
          <p className="text-sm text-gray-400">Sin datos aún.</p>
        ) : (
          <div className="divide-y">
            {data.products.map((p) => (
              <div key={p.id} className="flex justify-between py-2 text-sm">
                <span className="text-gray-700 truncate max-w-[70%]">{p.name}</span>
                <span className="text-gray-500 shrink-0">{p.count} consultas</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-100">
        <h2 className="text-base font-semibold text-gray-900 mb-3">💡 Insights automáticos</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          {data.commands.length > 0 && (
            <li>
              🔍 El comando más usado es <strong>"{data.commands[0].name}"</strong> con{" "}
              {data.commands[0].count} consultas.
            </li>
          )}
          {data.acceptanceRate < 50 && data.total > 0 && (
            <li>
              ⚠️ Tasa de aceptación baja ({data.acceptanceRate.toFixed(1)}%). Revisa la calidad del
              prompt del sistema.
            </li>
          )}
          {data.avgLatency > 3000 && (
            <li>
              ⏱️ Latencia media alta ({data.avgLatency.toFixed(0)}ms). Considera usar un modelo más
              rápido.
            </li>
          )}
          {data.products.length > 0 && (
            <li>
              📦 Producto más consultado:{" "}
              <strong>"{data.products[0].name}"</strong> ({data.products[0].count} consultas).
            </li>
          )}
          {data.total === 0 && (
            <li>
              Aún no hay datos de uso del Agente IA. Empieza a usar el chat para ver insights.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
