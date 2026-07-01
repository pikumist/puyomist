import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Slider } from './slider';

// Base UI positions thumbs via layout measurement which jsdom does not run,
// so the thumb inputs stay visibility:hidden and are not exposed via ARIA.
// Query the underlying range inputs directly instead.
describe('Slider', () => {
  it('renders a single range input with the default value', () => {
    const { container } = render(<Slider defaultValue={30} />);
    const inputs = container.querySelectorAll('input[type="range"]');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveAttribute('aria-valuenow', '30');
  });

  it('renders one input per value for a range', () => {
    const { container } = render(<Slider defaultValue={[20, 80]} />);
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2);
  });

  it('renders a single thumb at min when neither value nor defaultValue is given', () => {
    const { container } = render(<Slider min={5} max={10} />);
    const inputs = container.querySelectorAll('input[type="range"]');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveAttribute('aria-valuenow', '5');
  });
});
