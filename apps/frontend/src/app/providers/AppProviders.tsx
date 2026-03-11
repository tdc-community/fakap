import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactElement, StrictMode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { appRouter } from '@app/router';
import { SessionUserProvider } from '@features/auth';

const queryClient = new QueryClient();

export function AppProviders(): ReactElement {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <SessionUserProvider>
          <RouterProvider router={appRouter} />
        </SessionUserProvider>
      </QueryClientProvider>
    </StrictMode>
  );
}
