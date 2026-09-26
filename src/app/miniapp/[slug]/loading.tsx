export default function MiniAppLoading() {
  return (
    <div className="w-full min-h-[100vh] bg-[#0d0e10] animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/6">
        <div className="w-9 h-9 rounded-full bg-white/8" />
        <div className="h-5 w-32 bg-white/8 rounded-lg" />
        <div className="ml-auto w-8 h-8 rounded-lg bg-white/6" />
      </div>

      {/* Hero banner skeleton */}
      <div className="w-full h-44 bg-white/6 mt-1" />

      {/* Categories skeleton */}
      <div className="flex gap-3 px-3 py-2 mt-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="w-14 h-14 rounded-2xl bg-white/8" />
            <div className="h-2.5 w-12 bg-white/6 rounded" />
          </div>
        ))}
      </div>

      {/* Carousel skeleton */}
      <div className="px-4 mt-4">
        <div className="h-5 w-28 bg-white/8 rounded mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[120px]">
              <div className="w-full aspect-[3/4] bg-white/6 rounded-xl" />
              <div className="h-3 w-3/4 bg-white/6 rounded mt-2" />
              <div className="h-3 w-1/2 bg-white/6 rounded mt-1" />
            </div>
          ))}
        </div>
      </div>

      {/* Second carousel skeleton */}
      <div className="px-4 mt-5">
        <div className="h-5 w-36 bg-white/8 rounded mb-3" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[120px]">
              <div className="w-full aspect-[3/4] bg-white/6 rounded-xl" />
              <div className="h-3 w-3/4 bg-white/6 rounded mt-2" />
              <div className="h-3 w-1/2 bg-white/6 rounded mt-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
