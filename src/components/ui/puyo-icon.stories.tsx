import type { Meta, StoryObj } from '@storybook/react-vite';

import { PuyoAttr } from '@/logics/PuyoAttr';
import { PuyoType } from '@/logics/PuyoType';
import { PuyoIcon } from './puyo-icon';

const meta: Meta<typeof PuyoIcon> = {
  title: 'UI/PuyoIcon',
  component: PuyoIcon,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof PuyoIcon>;

export const Attributes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <PuyoIcon attr={PuyoAttr.Red} size={32} />
      <PuyoIcon attr={PuyoAttr.Blue} size={32} />
      <PuyoIcon attr={PuyoAttr.Green} size={32} />
      <PuyoIcon attr={PuyoAttr.Yellow} size={32} />
      <PuyoIcon attr={PuyoAttr.Purple} size={32} />
      <PuyoIcon attr={PuyoAttr.Heart} size={32} />
      <PuyoIcon attr={PuyoAttr.Prism} size={32} />
      <PuyoIcon attr={PuyoAttr.Ojama} size={32} />
    </div>
  )
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <PuyoIcon attr={PuyoAttr.Red} size={16} />
      <PuyoIcon attr={PuyoAttr.Red} size={24} />
      <PuyoIcon attr={PuyoAttr.Red} size={32} />
      <PuyoIcon attr={PuyoAttr.Red} size={48} />
    </div>
  )
};

export const ChanceAndPlus: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <PuyoIcon type={PuyoType.RedChance} size={32} />
      <PuyoIcon type={PuyoType.BluePlus} size={32} />
    </div>
  )
};
