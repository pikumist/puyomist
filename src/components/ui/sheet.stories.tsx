import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from './sheet';

const meta: Meta<typeof Sheet> = {
  title: 'UI/Sheet',
  component: Sheet,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof Sheet>;

function Demo({ side }: { side: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline">Open {side}</Button>} />
      <SheetContent side={side}>
        <SheetHeader>
          <SheetTitle>Field settings</SheetTitle>
          <SheetDescription>
            Adjust trace mode, minimum puyo and animation.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

export const Bottom: Story = { render: () => <Demo side="bottom" /> };
export const Right: Story = { render: () => <Demo side="right" /> };
export const Left: Story = { render: () => <Demo side="left" /> };
export const Top: Story = { render: () => <Demo side="top" /> };
