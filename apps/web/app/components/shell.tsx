import { useState } from 'react';
import { Form, Link, NavLink, Outlet, useLocation } from 'react-router';
import type { NavItem, SessionUser } from '@sge/shared';
import { Icon } from './icon';
import { Avatar, cx } from './ui';

export interface ShellProps {
  user: SessionUser;
  nav: NavItem[];
  /** Établissement : formule et état de l'abonnement. */
  school?: { name: string; group: string; plan: string; suspended: boolean; lockedNav?: string[] };
  space: string;
  /** Bandeau affiché au-dessus du contenu (ex. abonnement suspendu). */
  banner?: React.ReactNode;
}

export function Shell({ user, nav, school, space, banner }: ShellProps) {
  const [open, setOpen] = useState(false);
  const { pathname, search } = useLocation();

  const isActive = (to: string) => {
    const [path, query] = to.split('?');
    if (query) return pathname === path && search.includes(query);
    if (to === `/${space}`) return pathname === to;
    if (path === `/${space}/configuration`) return pathname === path && !search.includes('tab=classes');
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[236px_minmax(0,1fr)]">
      <div className="flex items-center justify-between border-b border-divider bg-neutral-100 px-4 py-3 lg:hidden">
        <Brand />
        <button type="button" aria-expanded={open} aria-controls="sidebar" aria-label="Menu" onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-md border border-divider">
          <Icon name={open ? 'x' : 'menu'} size={20} />
        </button>
      </div>

      <aside id="sidebar" className={cx('flex-col gap-4 border-r border-divider bg-neutral-100 px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen', open ? 'flex' : 'hidden')}>
        <div className="hidden px-1.5 lg:block"><Brand /></div>

        {school && (
          <div className="flex flex-col gap-2 rounded-lg border border-divider bg-bg p-2.5">
            <div className="flex items-center gap-2">
              <Icon name="school" size={16} className="text-accent-700" />
              <div className="min-w-0 flex-1 text-[13.5px] leading-tight">
                {school.name}
                <div className="text-[11px] text-neutral-600">{school.group}</div>
              </div>
            </div>
            <Link to="/ecole/abonnement" className={cx('flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[12px] no-underline hover:bg-accent-100', school.suspended ? 'border-accent-400 bg-accent-200 text-accent-900' : 'border-divider text-neutral-700')}>
              <Icon name="credit-card" size={13} />
              <span className="flex-1">{school.plan}</span>
              <span>{school.suspended ? 'suspendu' : 'actif'}</span>
            </Link>
          </div>
        )}

        <nav aria-label="Navigation principale" className="flex min-h-0 flex-1 flex-col gap-px overflow-auto">
          {nav.map((n) => {
            const locked = school?.lockedNav?.includes(n.label);
            const active = isActive(n.to);
            return (
              <NavLink key={n.label} to={n.to} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined}
                className={cx('flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[14px] no-underline', active ? 'bg-accent-100 text-accent-800 ring-1 ring-accent-300' : locked ? 'text-neutral-600 hover:bg-neutral-200' : 'text-text hover:bg-neutral-200 hover:text-text')}>
                <Icon name={n.icon} size={17} />
                <span className="flex-1">{n.label}</span>
                {locked ? <Icon name="lock" size={13} /> : n.badge && <span className="tnum text-[11px] text-accent-800">{n.badge}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2.5 border-t border-divider px-1.5 pt-3">
          <Avatar initials={user.initials} />
          <div className="min-w-0 flex-1 text-[13px] leading-tight">
            <div className="truncate">{user.name}</div>
            <div className="truncate text-[11.5px] text-neutral-600">{user.title}</div>
          </div>
          <Form method="post" action="/logout">
            <button type="submit" aria-label="Se déconnecter" title="Se déconnecter" className="grid h-9 w-9 place-items-center rounded-md text-neutral-600 hover:bg-neutral-200">
              <Icon name="log-out" size={16} />
            </button>
          </Form>
        </div>
      </aside>

      <main className="flex min-w-0 flex-col gap-6 px-5 py-6 sm:px-9 sm:pb-9 sm:pt-7">
        {banner}
        <Outlet />
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full border-[1.5px] border-accent font-heading text-[17px] italic text-accent-700">Sg</div>
      <div className="font-heading text-[15px] leading-tight font-semibold">Suivi et Gestion des Élèves</div>
    </div>
  );
}
