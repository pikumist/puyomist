import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { describe, expect, it } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import ThemeToggle from './ThemeToggle';

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>
        <ThemeToggle />
      </TooltipProvider>
    </ThemeProvider>
  );
}

describe('ThemeToggle', () => {
  it('renders a theme toggle button', () => {
    renderToggle();
    expect(
      screen.getByLabelText('ダークモードに切替')
    ).toBeInTheDocument();
  });

  it('switches to dark mode and updates the label when clicked', () => {
    renderToggle();
    fireEvent.click(screen.getByLabelText('ダークモードに切替'));
    expect(screen.getByLabelText('ライトモードに切替')).toBeInTheDocument();
  });
});
