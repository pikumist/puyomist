import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label';
import { Switch } from './switch';

const meta: Meta<typeof Switch> = {
  title: 'UI/Switch',
  component: Switch,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof Switch>;

export const Default: Story = { render: () => <Switch /> };

export const Checked: Story = { render: () => <Switch defaultChecked /> };

export const Disabled: Story = {
  render: () => (
    <div className="flex gap-4">
      <Switch disabled />
      <Switch disabled defaultChecked />
    </div>
  )
};

export const WithLabel: Story = {
  render: () => (
    <Label className="gap-2">
      <Switch defaultChecked />
      Repeat check
    </Label>
  )
};
