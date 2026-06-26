import type { Meta, StoryObj } from '@storybook/react-vite';

import { Progress } from './progress';

const meta: Meta<typeof Progress> = {
  title: 'UI/Progress',
  component: Progress,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <Progress value={60} />
    </div>
  )
};

export const Steps: Story = {
  render: () => (
    <div className="grid w-64 gap-3">
      <Progress value={0} />
      <Progress value={40} />
      <Progress value={100} />
    </div>
  )
};

export const Indeterminate: Story = {
  render: () => (
    <div className="w-64">
      <Progress value={null} />
    </div>
  )
};
