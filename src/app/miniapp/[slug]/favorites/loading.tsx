export default function FavoritesLoading() {
  return (
    <div className="p-4 pt-6 w-full animate-pulse">
      {/* Title skeleton */}
      <div className="h-7 w-36 bg-white/8 rounded-lg mb-6" />
      {/* Grid skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="w-full aspect-[3/4] bg-white/6 rounded-xl" />
            <div className="h-3 w-3/4 bg-white/6 rounded" />
            <div className="h-3 w-1/2 bg-white/6 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
