import { NavLink, Outlet } from 'react-router-dom';
import { FileSearch, Database, History, Settings, Home } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/corpus', label: 'Corpus', icon: Database },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <FileSearch className="w-7 h-7 text-primary-600" />
              <span>PCFA</span>
              <span className="hidden sm:inline text-sm font-normal text-gray-500">
                Plagiarism Checker & Fix Assistant
              </span>
            </NavLink>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="md:hidden flex items-center gap-2">
              {navItems.map(({ to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `p-2 rounded-lg ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-500'}`
                  }
                >
                  <Icon className="w-5 h-5" />
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          Plagiarism Checker & Fix Assistant — Local-first analysis with optional web checks
        </div>
      </footer>
    </div>
  );
}