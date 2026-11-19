import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/store/useAppStore';
import { landingPageForRole } from '@/routes/nav';

export default function AccessDenied() {
  const role = useAppStore((s) => s.session?.role);
  const landing = role ? landingPageForRole(role) : null;
  return <div className="mx-auto max-w-xl py-10"><Card><EmptyState icon={ShieldX} title="Access not available for this demo role" description="Switch to a role with permission to view this section, or return to a page available to you." action={landing ? <Link to={landing}><Button variant="secondary">Return to an available page</Button></Link> : undefined} /></Card><p className="mt-3 text-center text-meta text-slate">These frontend checks demonstrate navigation behavior. They are not production security.</p></div>;
}
