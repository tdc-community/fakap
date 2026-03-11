import { type ReactElement, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@app/layout/AppLayout';
import type { AppSection } from '@shared/types';
import { setAuthReturnTarget, type AppRole } from '@features/auth/services/auth.service';
import { useSessionUserState } from '../hooks/useSessionUser';

type RequireRoleRouteProps = {
  allow: AppRole[];
  section: AppSection;
};

function roleCanAccess(role: AppRole | null, allow: AppRole[]): boolean {
  if (!role) return false;
  return allow.includes(role);
}

export function RequireRoleRoute({ allow, section }: RequireRoleRouteProps): ReactElement {
  const location = useLocation();
  const { sessionUser, authChecked } = useSessionUserState();
  const role = sessionUser?.role ?? null;
  const unauthorized = authChecked && (!sessionUser || !roleCanAccess(role, allow));

  useEffect(() => {
    if (!unauthorized) return;
    setAuthReturnTarget(`${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, unauthorized]);

  if (!authChecked) {
    return <AppLayout section={section} />;
  }

  if (unauthorized) {
    return <Navigate to="/" replace />;
  }

  return <AppLayout section={section} />;
}
