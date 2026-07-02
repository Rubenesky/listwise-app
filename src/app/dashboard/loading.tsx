export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-200 rounded-lg" />
        <div className="h-9 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-3 text-center">
            <div className="h-6 w-10 bg-gray-200 rounded mx-auto mb-1" />
            <div className="h-3 w-20 bg-gray-100 rounded mx-auto" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="h-4 w-40 bg-gray-200 rounded" />
        </div>
        <div className="divide-y">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
              <div className="h-5 w-20 bg-gray-100 rounded" />
              <div className="h-7 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
