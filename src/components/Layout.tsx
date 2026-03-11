import { Outlet, NavLink } from 'react-router-dom';

const navItems = [
  { to: '/',          label: 'Home',      emoji: '🏠' },
  { to: '/templates', label: 'Templates', emoji: '📚' },
  { to: '/skills',    label: 'My Skills', emoji: '⚡' },
  { to: '/vault',     label: 'Vault',     emoji: '❤️‍🔥' },
];

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight text-orange-400">うまい <span className="text-white text-sm font-normal">Umai</span></span>
        <nav className="hidden sm:flex gap-1">
          {navItems.map(({ to, label, emoji }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-orange-500 text-white font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              {emoji} {label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 flex justify-around py-2 z-50">
        {navItems.map(({ to, label, emoji }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center text-xs gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                isActive ? 'text-orange-400 font-semibold' : 'text-gray-500 hover:text-white'
              }`
            }
          >
            <span className="text-xl leading-none">{emoji}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
