import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label';
import { RadioGroup, RadioGroupChip, RadioGroupItem } from './radio-group';

const meta: Meta<typeof RadioGroup> = {
  title: 'UI/RadioGroup',
  component: RadioGroup,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="damage">
      <Label className="gap-2">
        <RadioGroupItem value="damage" />
        Damage
      </Label>
      <Label className="gap-2">
        <RadioGroupItem value="puyo-count" />
        Puyo count
      </Label>
      <Label className="gap-2">
        <RadioGroupItem value="ptt" />
        PTT
      </Label>
    </RadioGroup>
  )
};

export const Chips: Story = {
  render: () => (
    <RadioGroup className="flex gap-1.5" defaultValue="red">
      <RadioGroupChip
        value="red"
        className="bg-red-500/12 data-checked:bg-red-400 data-checked:text-red-950"
      >
        Red
      </RadioGroupChip>
      <RadioGroupChip
        value="blue"
        className="bg-blue-500/12 data-checked:bg-blue-400 data-checked:text-blue-950"
      >
        Blue
      </RadioGroupChip>
      <RadioGroupChip
        value="green"
        className="bg-green-500/12 data-checked:bg-green-400 data-checked:text-green-950"
      >
        Green
      </RadioGroupChip>
    </RadioGroup>
  )
};
