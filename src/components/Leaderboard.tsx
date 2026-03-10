import { Trophy, Dumbbell, Flame, Target } from 'lucide-react';

const MOCK_PRS = [
  { id: 1, name: 'Mike T.', exercise: 'Deadlift', weight: 405, reps: 1, type: 'strength', time: '2m ago' },
  { id: 2, name: 'Sarah J.', exercise: 'Squat', weight: 225, reps: 5, type: 'strength', time: '15m ago' },
  { id: 3, name: 'David C.', exercise: '1 Mile Run', weight: null, reps: '6:45', type: 'endurance', time: '1h ago' },
  { id: 4, name: 'Alex R.', exercise: 'Bench Press', weight: 275, reps: 1, type: 'strength', time: '3h ago' },
];

export default function Leaderboard() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2 text-white uppercase tracking-tighter italic">
          <Trophy className="w-5 h-5 text-yellow-500" />
          The Feed
        </h2>
        <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-500/20">
          Global
        </span>
      </div>

      <div className="space-y-3">
        {MOCK_PRS.map((pr) => (
          <div key={pr.id} className="flex items-start gap-4 p-4 rounded-xl border border-gray-800 bg-gray-950/50 hover:bg-gray-800 transition-all group">
            <div className={`p-2 rounded-lg ${pr.type === 'strength' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-orange-500/10 text-orange-400'}`}>
              {pr.type === 'strength' ? <Dumbbell className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-gray-200 text-sm">{pr.name}</p>
                <span className="text-[10px] text-gray-600 font-bold">{pr.time}</span>
              </div>
              <p className="text-xs text-gray-500 truncate">
                PR: <span className="font-bold text-gray-300">{pr.exercise}</span>
              </p>
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md bg-gray-900 border border-gray-800 text-indigo-400 uppercase tracking-widest">
                  {pr.weight ? `${pr.weight} LBS x ${pr.reps}` : pr.reps}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="w-full pt-2 text-[10px] font-black text-gray-600 hover:text-gray-400 transition-colors flex items-center justify-center gap-2 uppercase tracking-[0.3em]">
        View Rankings
      </button>
    </div>
  );
}
