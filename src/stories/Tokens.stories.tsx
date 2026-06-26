import type { Meta, StoryObj } from '@storybook/react-vite';
import { cn } from '@/lib/utils';

/**
 * Phase 0 smoke story: verifies the Tailwind v4 + globals.css token
 * pipeline renders, and that light/dark toggling works from the toolbar.
 * Real UI primitive stories are added in Phase 2.
 */
function TokenSwatches() {
  const tokens = [
    'bg-background text-foreground',
    'bg-surface text-foreground',
    'bg-primary text-primary-foreground',
    'bg-secondary text-secondary-foreground',
    'bg-accent text-accent-foreground',
    'bg-muted text-muted-foreground',
    'bg-destructive text-white'
  ];
  return (
    <div className="p-6 bg-background text-foreground min-h-dvh">
      <h1 className="text-lg font-semibold mb-4">puyomist design tokens</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tokens.map((t) => (
          <div
            key={t}
            className={cn(
              'rounded-lg border border-border p-4 text-sm shadow-sm',
              t
            )}
          >
            {t.split(' ')[0]}
          </div>
        ))}
      </div>
    </div>
  );
}

const meta: Meta<typeof TokenSwatches> = {
  title: 'Foundation/Design Tokens',
  component: TokenSwatches
};

export default meta;

type Story = StoryObj<typeof TokenSwatches>;

export const Default: Story = {};
