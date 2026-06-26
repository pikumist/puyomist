import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

function Fixture() {
  return (
    <Tabs defaultValue="field">
      <TabsList>
        <TabsTrigger value="field">Field</TabsTrigger>
        <TabsTrigger value="explore">Explore</TabsTrigger>
      </TabsList>
      <TabsContent value="field">field-panel</TabsContent>
      <TabsContent value="explore">explore-panel</TabsContent>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('renders the default tab panel', () => {
    render(<Fixture />);
    expect(screen.getByText('field-panel')).toBeInTheDocument();
  });

  it('switches panel when another tab is clicked', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('tab', { name: 'Explore' }));
    expect(screen.getByText('explore-panel')).toBeInTheDocument();
  });
});
