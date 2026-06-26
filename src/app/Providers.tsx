import { ThemeProvider } from 'next-themes';
import type * as React from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Application-wide providers for the new (shadcn/Tailwind) UI.
 *
 * - next-themes drives the `.dark` class on <html> (CSS-token theming).
 * - TooltipProvider supplies a shared open/close delay for all tooltips.
 *
 * State lives in the zustand store (`usePuyoAppStore`), so no store provider
 * is required here.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delay={400}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}

export default Providers;
