export default function CartLoading() {
  return (
    <div className="p-4 pt-4 w-full animate-pulse">
      {/* Item skeletons */}
      <div className="space-y-3 mb-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 bg-white/4 rounded-2xl p-3">
            <div className="w-[60px] h-[84px] flex-shrink-0 rounded-xl bg-white/8" />
            <div className="flex-1 flex flex-col justify-between">
              <div className="h-4 w-3/4 bg-white/8 rounded" />
              <div className="h-4 w-1/3 bg-white/8 rounded mt-2" />
            </div>
          </div>
        ))}
      </div>
      {/* Summary skeleton */}
      <div className="h-32 bg-white/4 rounded-2xl mb-5" />
      {/* Button skeleton */}
      <div className="h-14 bg-red-600/30 rounded-2xl" />
    </div>
  );
}
