import { Trophy, Dumbbell, Flame, Target } from 'lucide-react';

const MOCK_PRS = [
  { id: 1, name: 'Mike T.', exercise: 'Deadlift', weight: 405, reps: 1, type: 'strength', time: '2m ago' },
  { id: 2, name: 'Sarah J.', exercise: 'Squat', weight: 225, reps: 5, type: 'strength', time: '15m ago' },
  { id: 3, name: 'David C.', exercise: '1 Mile Run', weight: null, reps: '6:45', type: 'endurance', time: '1h ago' },
  { id: 4, name: 'Alex R.', exercise: 'Bench Press', weight: 275, reps: 1, type: 'strength', time: '3h ago' },
];

export default function Leaderboard() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Recent PRs & Wins
        </h2>
        <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
          Live Feed
        </span>
      </div>

      <div className="space-y-4">
        {MOCK_PRS.map((pr) => (
          <div key={pr.id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
            <div className={`p-2 rounded-lg ${pr.type === 'strength' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
              {pr.type === 'strength' ? <Dumbbell className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800 text-sm">{pr.name}</p>
                <span className="text-xs text-slate-400">{pr.time}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Hit a new PR on <span className="font-medium text-slate-800">{pr.exercise}</span>
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shadow-sm">
                  <Target className="w-3 h-3 text-emerald-500" />
                  {pr.weight ? `${pr.weight} lbs × ${pr.reps}` : pr.reps}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full mt-6 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-2">
        View Full Leaderboard
      </button>
    </div>
  );
}