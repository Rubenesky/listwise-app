"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const ADMIN_USER_IDS = ["user_3FKeQMYvlFqlnt1QqG8pURl1ARl"];

interface SummaryData {
  activeUsers: number;
  totalPoints: number;
  totalUsers: number;
  levelDistribution: { level: number; name: string; icon: string; count: number }[];
}

interface ActionsData {
  actions: { action: string; count: number; percentage: number }[];
  total: number;
}

export default function AdminInsightsPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [actionsData, setActionsData] = useState<ActionsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/sign-in"); return; }
    if (user?.id && !ADMIN_USER_IDS.includes(user.id)) { router.push("/dashboard"); return; }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (!isSignedIn || !user?.id || !ADMIN_USER_IDS.includes(user.id)) return;
    Promise.all([
      fetch("/api/admin/insights/summary").then((r) => r.json()),
      fetch("/api/admin/insights/actions").then((r) => r.json()),
    ])
      .then(([s, a]) => { setSummary(s); setActionsData(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isSignedIn, user]);

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (!summary) {
    return <div className="text-center py-12 text-gray-500">No hay datos disponibles.</div>;
  }

  const chartData = summary.levelDistribution.map((l) => ({
    name: l.name,
    usuarios: l.count,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">📊 ListWise Insights</h1>
      <p className="text-sm text-gray-500 mb-6">Panel de administración — Gamificación</p>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{summary.activeUsers}</p>
          <p className="text-xs text-gray-500 mt-1">Usuarios activos (30d)</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{summary.totalUsers}</p>
          <p className="text-xs text-gray-500 mt-1">Usuarios registrados</p>
        </div>
        <div className="bg-white rounded-lg border p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{summary.totalPoints.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Puntos totales</p>
        </div>
      </div>

      {/* Level distribution chart */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Distribución por nivel</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="usuarios" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Actions breakdown */}
      {actionsData && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Acciones más realizadas</h2>
          {actionsData.actions.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos aún.</p>
          ) : (
            <div className="space-y-3">
              {actionsData.actions.map((a) => (
                <div key={a.action}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 capitalize">{a.action.replace(/_/g, " ")}</span>
                    <span className="text-gray-500">{a.count} ({a.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(a.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
