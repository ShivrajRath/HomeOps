import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FolderLock,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  LogOut,
  MapPin,
  Settings,
} from 'lucide-react';
import Logo from './Logo';
import SyncIndicator from './SyncIndicator';
import { cx, initialsFromEmail } from '../lib/utils';
import { dayDiff, todayYMD } from '../lib/date';
import { db, getPrimaryProperty } from '../lib/db';
import { useAuthStore } from '../store/useAuthStore';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Task plan', shortLabel: 'Tasks', icon: ListChecks },
  { to: '/documents', label: 'Document vault', shortLabel: 'Vault', icon: FolderLock },
  { to: '/rooms', label: 'Spaces', shortLabel: 'Spaces', icon: LayoutGrid },
  { to: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

function NavItem({ item, overdueCount, mobile = false }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine-500',
          mobile
            ? cx(
                'flex-col gap-1 rounded-lg px-1 py-1.5 text-[10px] font-medium',
                isActive ? 'text-pine-800' : 'text-ink-soft hover:text-ink',
              )
            : cx(
                'gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium',
                isActive
                  ? 'bg-pine-700 text-white shadow-sm'
                  : 'text-ink-muted hover:bg-white hover:text-ink',
              ),
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={cx('relative', mobile && isActive && 'text-pine-700')}>
            <Icon size={mobile ? 20 : 17} strokeWidth={mobile && isActive ? 2.2 : 1.9} />
            {overdueCount > 0 && item.to === '/tasks' && (
              <span
                className={cx(
                  'absolute -right-2 -top-1.5 grid min-w-[15px] place-items-center rounded-full px-1 text-[9px] font-semibold leading-4',
                  mobile ? 'bg-clay-500 text-white' : 'bg-clay-400 text-clay-900',
                )}
              >
                {overdueCount > 9 ? '9+' : overdueCount}
              </span>
            )}
          </span>
          <span className="truncate">{mobile ? item.shortLabel : item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const property = useLiveQuery(getPrimaryProperty, []);
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const navigate = useNavigate();
  const location = useLocation();

  const overdueCount =
    useLiveQuery(
      async () => {
        const tasks = await db.tasks.where('status').equals('active').toArray();
        const today = todayYMD();
        return tasks.filter((task) => dayDiff(task.nextDueDate, today) < 0).length;
      },
      [],
      0,
    ) ?? 0;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sand-200/80 bg-white/70 backdrop-blur lg:flex">
        <div className="px-5 py-5">
          <Link to="/" aria-label="HomeOps dashboard">
            <Logo showTagline />
          </Link>
        </div>

        {property && (
          <div className="mx-3 rounded-xl border border-sand-200 bg-sand-50/80 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              Your home
            </p>
            <p className="mt-1 flex items-start gap-1.5 text-sm font-medium leading-snug text-ink">
              <MapPin size={14} className="mt-0.5 shrink-0 text-pine-600" />
              <span className="line-clamp-2">{property.address}</span>
            </p>
          </div>
        )}

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} overdueCount={overdueCount} />
          ))}
        </nav>

        <div className="border-t border-sand-200 p-3">
          <SyncIndicator />
          <div className="mt-1 flex items-center gap-2.5 rounded-xl px-2 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pine-100 text-[11px] font-semibold text-pine-800">
              {initialsFromEmail(session?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">
                {session?.name || session?.email}
              </p>
              <p className="truncate text-[10px] text-ink-soft">{session?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition hover:bg-sand-100 hover:text-ink"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sand-200/70 bg-sand-50/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link to="/" aria-label="HomeOps dashboard">
            <Logo />
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            className="grid h-9 w-9 place-items-center rounded-xl border border-sand-200 bg-white text-ink-muted"
          >
            <Settings size={18} />
          </Link>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} item={item} overdueCount={overdueCount} mobile />
          ))}
        </div>
      </nav>
    </div>
  );
}
