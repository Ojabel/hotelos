import { Link, matchPath, useLocation } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ROUTES } from '@/routes/nav';
import { landingPageForRole } from '@/routes/nav';
import { useAppStore } from '@/store/useAppStore';

/**
 * Honest stand-in for screens scheduled in a later milestone.
 * Not a finished page — see routes/pageRegistry.ts for what is actually implemented.
 */
export default function ComingSoon() {
  const { pathname } = useLocation();
  const role = useAppStore((s) => s.session?.role);
  const landing = role ? landingPageForRole(role) ?? '/login' : '/login';
  const meta = ROUTES.find((r) => matchPath({ path: r.path, end: true }, pathname));
  return (
    <>
      <PageHeader title={meta?.title ?? 'Page'} description={meta?.summary} />
      <Card>
        <EmptyState
          icon={Hammer}
          title={meta ? `Scheduled for Milestone ${meta.milestone}` : 'Not built yet'}
          description="This route is wired into navigation and access control, but its screen has not been implemented yet."
          action={<Link to={landing}><Button variant="secondary">Back to an available page</Button></Link>}
        />
      </Card>
    </>
  );
}
