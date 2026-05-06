import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { queryClient } from '@/lib/query';
import { router } from '@/routes/router';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ duration: 4500 }}
        // Sit above every dialog / sheet / popover (each ~z-50). 200 lost to
        // certain library overlays in production; 9999 puts us clearly above any
        // reasonable UI layer while staying well below the int-overflow watermark
        // some libraries reserve for system-modal use.
        style={{ zIndex: 9999 } as React.CSSProperties}
      />
    </QueryClientProvider>
  </StrictMode>,
);
