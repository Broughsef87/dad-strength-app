import BodyVitals from '../../components/BodyVitals';
import NapSqueeze from '../../components/NapSqueeze';
import ProteinTracker from '../../components/ProteinTracker';
import BottomNav from '../../components/BottomNav';

export default function BodyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <div className="max-w-md mx-auto px-6 pt-10">

        <div className="mb-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-brand font-medium mb-2">Physical</p>
          <h1 className="text-3xl font-light tracking-tight">Body</h1>
        </div>

        <div className="space-y-6">
          <BodyVitals />

          <NapSqueeze />

          <section>
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mb-4">Metabolic Tracking</h3>
            <ProteinTracker />
          </section>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
