import { Fragment } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ROUTES } from '@/routes/nav';
import { useAppStore } from '@/store/useAppStore';
import { landingPageForRole } from '@/routes/nav';

const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const role = useAppStore((s) => s.session?.role);
  const home = role ? landingPageForRole(role) ?? '/login' : '/login';
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = segments.map((seg, i) => {
    const path = '/' + segments.slice(0, i + 1).join('/');
    const route = ROUTES.find((r) => matchPath({ path: r.path, end: true }, path));
    return { path, label: route?.title ?? titleCase(seg), linkable: Boolean(route) && i < segments.length - 1 };
  });
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-meta text-slate">
        <li className="hidden sm:block"><Link to={home} className="hover:text-forest">Home</Link></li>
        {crumbs.map((c, i) => (
          <Fragment key={c.path}>
            <li aria-hidden className="hidden sm:block"><ChevronRight className="h-3.5 w-3.5" /></li>
            <li className={i === crumbs.length - 1 ? 'truncate font-medium text-forest' : 'hidden sm:block'} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
              {c.linkable ? <Link to={c.path} className="hover:text-forest">{c.label}</Link> : c.label}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
