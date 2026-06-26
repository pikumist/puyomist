import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { beforeEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import TopBar from './TopBar';

const renderTopBar = () =>
  render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>
        <TopBar />
      </TooltipProvider>
    </ThemeProvider>
  );

describe('TopBar', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('renders the app name and board controls', () => {
    renderTopBar();
    expect(screen.getByText('Puyomist')).toBeInTheDocument();
    expect(screen.getByLabelText('盤面の選択')).toBeInTheDocument();
    expect(screen.getByLabelText('ネクストぷよの選択')).toBeInTheDocument();
  });

  it('exposes the mobile field/exploration sheet triggers', () => {
    renderTopBar();
    expect(screen.getByLabelText('フィールド設定を開く')).toBeInTheDocument();
    expect(screen.getByLabelText('探索設定を開く')).toBeInTheDocument();
  });
});
