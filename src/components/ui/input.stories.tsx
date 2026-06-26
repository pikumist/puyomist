import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from './input';
import { Label } from './label';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: { layout: 'centered' },
  args: { placeholder: 'Type here…' }
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => (
    <div className="w-64">
      <Input {...args} />
    </div>
  )
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-64 gap-1.5">
      <Label htmlFor="min-puyo">Minimum puyo</Label>
      <Input id="min-puyo" type="number" defaultValue={3} />
    </div>
  )
};

export const States: Story = {
  render: () => (
    <div className="grid w-64 gap-3">
      <Input placeholder="Default" />
      <Input placeholder="Disabled" disabled />
      <Input placeholder="Invalid" aria-invalid />
    </div>
  )
};
