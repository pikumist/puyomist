import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label';
import { RadioGroup, RadioGroupItem } from './radio-group';

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
