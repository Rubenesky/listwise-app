"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  createdAt: number;
}

const TX_ICONS: Record<string, string> = {
  agent: "🤖",
  csv: "📄",
  competitor: "🔍",
  pack: "💳",
  subscription: "💳",
  bonus: "🎁",
  referral: "🤝",
};

const TX_LABELS: Record<string, string> = {
  agent: "Agente IA",
  csv: "Subida CSV",
  competitor: "Análisis competidor",
  pack: "Pack de créditos",
  subscription: "Suscripción",
  bonus: "Bonificación",
  referral: "Referido",
};

function txIcon(type: string): string {
  return TX_ICONS[type] ?? "⚡";
}

function txLabel(type: string): string {
  return TX_LABELS[type] ?? type;
}

export default function CreditsHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/user/credits/history").then((r) => r.json()),
      fetch("/api/user/credits").then((r) => r.json()),
    ])
      .then(([historyData, creditsData]) => {
        setTransactions(historyData.transactions ?? []);
        setCredits(creditsData.credits ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Historial de créditos</h1>
          <p className="text-xs text-gray-500">Todos tus movimientos de créditos de uso</p>
        </div>
        {credits !== null && (
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
            <Zap className="w-4 h-4" />
            <span>{credits} créditos</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-sm">Cargando...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-3xl mb-2">⚡</p>
          <p className="text-sm text-gray-500">Aún no tienes movimientos de créditos.</p>
          <Link
            href="/pricing"
            className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Comprar créditos
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-medium text-gray-500">{transactions.length} transacciones (últimas 50)</p>
          </div>
          <div className="divide-y divide-gray-50">
            {transactions.map((tx) => {
              const date = new Date(tx.createdAt * 1000);
              const isPositive = tx.amount >= 0;
              return (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-base shrink-0">
                    {txIcon(tx.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium truncate">
                      {tx.description ?? txLabel(tx.type)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {txLabel(tx.type)} · {date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })} {date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className={`text-sm font-bold shrink-0 ${isPositive ? "text-green-600" : "text-red-500"}`}>
                    {isPositive ? `+${tx.amount}` : tx.amount}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-center">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Zap className="w-4 h-4" />
          Comprar más créditos
        </Link>
      </div>
    </div>
  );
}
