import { createRoot } from 'react-dom/client';
import { AppProviders } from '@app/providers/AppProviders';
import '@app/styles/app-shell.css';
import '@features/news/styles/news.css';
import '@features/admin/styles/admin.css';
import '@features/wallet/styles/wallet.css';
import '@features/vehicles/styles/vehicles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <AppProviders />,
);
