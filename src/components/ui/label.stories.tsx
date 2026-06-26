import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label';

const meta: Meta<typeof Label> = {
  title: 'UI/Label',
  component: Label,
  parameters: { layout: 'centered' },
  args: { children: 'Label text' }
};

export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {};
