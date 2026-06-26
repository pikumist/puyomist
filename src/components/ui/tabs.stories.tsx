import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const meta: Meta<typeof Tabs> = {
  title: 'UI/Tabs',
  component: Tabs,
  parameters: { layout: 'centered' }
};

export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="field" className="w-80">
      <TabsList className="w-full">
        <TabsTrigger value="field">Field</TabsTrigger>
        <TabsTrigger value="explore">Explore</TabsTrigger>
      </TabsList>
      <TabsContent value="field">Field settings panel.</TabsContent>
      <TabsContent value="explore">Exploration settings panel.</TabsContent>
    </Tabs>
  )
};

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="a" className="w-80">
      <TabsList variant="line">
        <TabsTrigger value="a">One</TabsTrigger>
        <TabsTrigger value="b">Two</TabsTrigger>
        <TabsTrigger value="c">Three</TabsTrigger>
      </TabsList>
      <TabsContent value="a">First</TabsContent>
      <TabsContent value="b">Second</TabsContent>
      <TabsContent value="c">Third</TabsContent>
    </Tabs>
  )
};
