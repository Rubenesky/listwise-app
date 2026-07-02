export default function AgentLoading() {
  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)] animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-72 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden shrink-0">
        <div className="p-3 border-b">
          <div className="h-9 bg-gray-200 rounded-xl w-full" />
        </div>
        <div className="flex-1 overflow-hidden p-2 space-y-1.5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2.5 rounded-xl">
              <div className="w-8 h-8 bg-gray-200 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat skeleton */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-5 w-12 bg-gray-100 rounded-full" />
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 space-y-4">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-full shrink-0 mt-0.5" />
            <div className="space-y-1.5 max-w-[70%]">
              <div className="h-3.5 bg-gray-200 rounded w-56" />
              <div className="h-3.5 bg-gray-200 rounded w-40" />
              <div className="h-3.5 bg-gray-200 rounded w-48" />
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="border-t p-2.5">
          <div className="flex gap-2">
            <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
