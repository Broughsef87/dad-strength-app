export default function BodyLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {/* Header skeleton */}
      <div className="hidden md:flex items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 w-12 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
      <div className="md:hidden flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
        </div>
        <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
      </div>

      <div className="max-w-lg mx-auto px-6 pt-6 space-y-5">
        {/* Page label */}
        <div className="space-y-1">
          <div className="h-2 w-16 bg-muted/50 rounded animate-pulse" />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>

        {/* Active program card */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/50" />
            <div className="space-y-1.5">
              <div className="h-2 w-20 bg-muted/50 rounded" />
              <div className="h-5 w-40 bg-muted rounded" />
            </div>
          </div>
          <div className="h-1.5 w-full bg-muted/30 rounded-full" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 w-full bg-muted/20 rounded-xl" />
          ))}
        </div>

        {/* Second card */}
        <div className="rounded-2xl bg-card border border-border p-5 space-y-3 animate-pulse">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-24 w-full bg-muted/20 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
