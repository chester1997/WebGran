export default function AccessesLoading() {
  return (
    <div className="p-4 pt-6 w-full animate-pulse">
      {/* Title skeleton */}
      <div className="h-7 w-40 bg-white/8 rounded-lg mb-6" />
      {/* Item skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3 bg-white/4 rounded-2xl p-4">
            <div className="w-12 h-12 rounded-xl bg-white/8 flex-shrink-0" />
            <div className="flex-1 flex flex-col justify-center gap-2">
              <div className="h-4 w-2/3 bg-white/8 rounded" />
              <div className="h-3 w-1/3 bg-white/6 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
