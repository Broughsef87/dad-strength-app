export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      {/* Mobile header skeleton */}
      <div className="md:hidden flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
          <div className="flex flex-col gap-1">
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
            <div className="h-2 w-16 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Desktop header skeleton */}
      <div className="hidden md:flex items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
          <div className="flex flex-col gap-1">
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
            <div className="h-2 w-16 bg-muted/50 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 w-12 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 pt-6 space-y-5">
        {/* Date / heading */}
        <div className="space-y-1.5">
          <div className="h-3 w-40 bg-muted/50 rounded animate-pulse" />
          <div className="h-7 w-32 bg-muted rounded animate-pulse" />
        </div>

        {/* Card 1 */}
        <div className="rounded-xl bg-foreground/5 border border-border p-6 space-y-4 animate-pulse">
          <div className="h-3 w-24 bg-muted/50 rounded" />
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-4 w-full bg-muted/30 rounded" />
          <div className="h-12 w-full bg-muted/20 rounded-lg" />
        </div>

        {/* Card 2 */}
        <div className="rounded-xl bg-card border border-border p-5 space-y-3 animate-pulse">
          <div className="h-3 w-32 bg-muted/50 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 w-full bg-muted/20 rounded-lg" />
          ))}
        </div>

        {/* Card 3 */}
        <div className="rounded-xl bg-card border border-border p-5 space-y-3 animate-pulse">
          <div className="h-3 w-24 bg-muted/50 rounded" />
          <div className="h-16 w-full bg-muted/20 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
