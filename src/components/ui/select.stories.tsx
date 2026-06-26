import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select';

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="red">
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Pick a color" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="red">Red</SelectItem>
        <SelectItem value="green">Green</SelectItem>
        <SelectItem value="blue">Blue</SelectItem>
        <SelectItem value="yellow">Yellow</SelectItem>
        <SelectItem value="purple">Purple</SelectItem>
      </SelectContent>
    </Select>
  )
};

export const Grouped: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Trace mode" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectGroupLabel>Modes</SelectGroupLabel>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="to-red">To red</SelectItem>
          <SelectItem value="to-blue">To blue</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
};
