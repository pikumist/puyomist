import type { Meta, StoryObj } from '@storybook/react-vite';

import { Slider } from './slider';

const meta: Meta<typeof Slider> = {
  title: 'UI/Slider',
  component: Slider,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  render: () => (
    <div className="w-64">
      <Slider defaultValue={50} />
    </div>
  )
};

export const Range: Story = {
  render: () => (
    <div className="w-64">
      <Slider defaultValue={[20, 80]} />
    </div>
  )
};

export const Disabled: Story = {
  render: () => (
    <div className="w-64">
      <Slider defaultValue={40} disabled />
    </div>
  )
};
