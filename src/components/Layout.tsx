import { Outlet, NavLink } from 'react-router-dom';

const NAV = [
  { to: '/',         emoji: '🏠', label: 'Home'     },
  { to: '/session',  emoji: '🎬', label: 'Shadow'   },
  { to: '/vault',    emoji: '📚', label: 'Vault'    },
  { to: '/progress', emoji: '📊', label: 'Progress' },
  { to: '/settings', emoji: '⚙️', label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Page content */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 pb-28">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-gray-900/95 backdrop-blur border-t border-gray-800 flex justify-around py-2 z-50">
        {NAV.map(({ to, emoji, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors text-xs ${
                isActive ? 'text-indigo-400 font-bold' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <span className="text-xl">{emoji}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
