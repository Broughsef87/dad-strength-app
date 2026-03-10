'use client'

import { Flame, Dumbbell, Target, Trophy } from 'lucide-react'

const MOCK_PRS = [
  { id: 1, name: 'Mike T.', exercise: 'Deadlift', weight: 405, reps: 1, type: 'strength', time: '2m ago' },
  { id: 2, name: 'Sarah J.', exercise: 'Squat', weight: 225, reps: 5, type: 'strength', time: '15m ago' },
  { id: 3, name: 'David C.', exercise: '1 Mile Run', weight: null, reps: '6:45', type: 'endurance', time: '1h ago' },
  { id: 4, name: 'Alex R.', exercise: 'Bench Press', weight: 275, reps: 1, type: 'strength', time: '3h ago' },
];

export default function Leaderboard() {
  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-5 mt-6 mb-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-white">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Live Feed
        </h2>
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Recent PRs</span>
      </div>

      <div className="space-y-3">
        {MOCK_PRS.map((pr) => (
          <div key={pr.id} className="flex items-start gap-4 p-4 rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800/80 transition-colors">
            <div className={`p-2 rounded-lg flex-shrink-0 ${pr.type === 'strength' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-orange-500/20 text-orange-400'}`}>
              {pr.type === 'strength' ? <Dumbbell className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-gray-200 truncate">{pr.name}</p>
                <span className="text-[10px] text-gray-500 whitespace-nowrap">{pr.time}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 truncate">
                Hit a PR on <span className="font-semibold text-gray-300">{pr.exercise}</span>
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md bg-gray-950 border border-gray-700 text-emerald-400 shadow-sm">
                  <Target className="w-3 h-3" />
                  {pr.weight ? `${pr.weight} lbs × ${pr.reps}` : pr.reps}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}