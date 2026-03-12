import { Outlet, NavLink } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <NavLink to="/" className="text-lg font-black tracking-tight">
          <span className="text-indigo-400">うまい</span>
          <span className="text-gray-400 text-sm font-medium ml-2">Japanese Shadowing</span>
        </NavLink>
        <NavLink
          to="/session"
          className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full transition-colors"
        >
          ▶ Shadow
        </NavLink>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="sticky bottom-0 bg-gray-950/90 backdrop-blur border-t border-gray-800 flex justify-around px-2 py-2">
        {([
          ['/', '🏠', 'Home'],
          ['/templates', '🎬', 'Anime'],
          ['/session', '🗣️', 'Shadow'],
          ['/vault', '📚', 'Vault'],
          ['/progress', '📊', 'Progress'],
        ] as const).map(([to, emoji, label]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-xs transition-colors ${
                isActive ? 'text-indigo-400 font-bold' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <span className="text-xl">{emoji}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
