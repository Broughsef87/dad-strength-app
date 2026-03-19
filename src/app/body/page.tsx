import BodyVitals from '../../components/BodyVitals';
import NapSqueeze from '../../components/NapSqueeze';

export default function BodyPage() {
  return (
    <div className="min-h-screen bg-black pb-24">
      <div className="max-w-md mx-auto px-6 pt-12">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-4 w-1 bg-indigo-500" />
          <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Sector 02 // Physical</h2>
        </div>
        <h1 className="text-4xl font-black text-foreground tracking-tight italic uppercase mb-8">Body</h1>

        <div className="space-y-12">
          {/* Active Workouts */}
          <BodyVitals />

          {/* Revenue Gate */}
          <NapSqueeze />

          {/* Vitals */}
          <section>
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Metabolic Tracking</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card/50 border border-border rounded-3xl p-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Daily Protein</p>
                <p className="text-2xl font-black text-foreground leading-none">145<span className="text-xs text-indigo-500 ml-1">G</span></p>
              </div>
              <div className="bg-card/50 border border-border rounded-3xl p-6">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Calorie Target</p>
                <p className="text-2xl font-black text-foreground leading-none">2,850</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

