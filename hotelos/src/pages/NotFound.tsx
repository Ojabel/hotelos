import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAppStore } from '@/store/useAppStore';
import { landingPageForRole } from '@/routes/nav';

export default function NotFound() {
  const role = useAppStore((s) => s.session?.role);
  const landing = role ? landingPageForRole(role) ?? '/login' : '/login';
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory">
      <EmptyState icon={Compass} title="Page not found" description="The page you are looking for does not exist." action={<Link to={landing}><Button>Return to an available page</Button></Link>} />
    </div>
  );
}
