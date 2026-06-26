import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScrollArea } from './scroll-area';

const meta: Meta<typeof ScrollArea> = {
  title: 'UI/ScrollArea',
  component: ScrollArea,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof ScrollArea>;

export const Default: Story = {
  render: () => (
    <ScrollArea className="h-48 w-64 rounded-lg border border-border p-3">
      <div className="grid gap-2 text-sm">
        {Array.from({ length: 30 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static demo list
          <div key={i}>Row {i + 1}</div>
        ))}
      </div>
    </ScrollArea>
  )
};
