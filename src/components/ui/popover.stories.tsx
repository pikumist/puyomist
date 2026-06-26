import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const meta: Meta<typeof Popover> = {
  title: 'UI/Popover',
  component: Popover,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger render={<Button variant="outline">Open popover</Button>} />
      <PopoverContent>
        <div className="grid gap-2">
          <p className="font-medium">Board edit</p>
          <p className="text-muted-foreground">
            Pick a puyo to place on the board.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
};
