import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NumberStepper } from './NumberStepper';

describe('NumberStepper', () => {
  it('renders the formatted value', () => {
    render(
      <NumberStepper
        ariaLabel="倍率"
        value={1.5}
        step={0.1}
        onChange={() => {}}
      />
    );
    expect(screen.getByLabelText('倍率')).toHaveValue('1.5');
  });

  it('increments by step and clamps to max', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={14}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText('数を増やす'));
    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('disables increment at the maximum', () => {
    render(
      <NumberStepper
        ariaLabel="数"
        value={15}
        min={1}
        max={15}
        onChange={() => {}}
      />
    );
    expect(screen.getByLabelText('数を増やす')).toBeDisabled();
  });

  it('decrements and respects decimal precision', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="倍率"
        value={1.5}
        min={1}
        max={9.9}
        step={0.1}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText('倍率を減らす'));
    expect(onChange).toHaveBeenCalledWith(1.4);
  });

  it('commits a typed value on blur', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('数');
    fireEvent.change(input, { target: { value: '7' } });
    expect(onChange).not.toHaveBeenCalled(); // not while typing
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('commits a typed value on Enter', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('数');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('lets the user type intermediate decimals freely', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="倍率"
        value={1.0}
        min={1}
        max={9.9}
        step={0.1}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('倍率');
    // typing "7" must not be reformatted to "7.0" mid-edit
    fireEvent.change(input, { target: { value: '7' } });
    expect(input).toHaveValue('7');
    expect(onChange).not.toHaveBeenCalled();
    // and the trailing-dot state is preserved while editing
    fireEvent.change(input, { target: { value: '7.' } });
    expect(input).toHaveValue('7.');
    // committing snaps to the configured precision
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(7);
    expect(input).toHaveValue('7.0');
  });

  it('clamps a typed value to the range on commit', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('数');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(15);
  });

  it('reverts non-numeric input on commit', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('数');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('5');
  });

  it('ignores external value updates while the field is focused', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('数');
    fireEvent.focus(input);
    // An external value change (e.g. a store reset) must not clobber the draft
    // while the user is actively editing the field.
    rerender(
      <NumberStepper
        ariaLabel="数"
        value={9}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    expect(input).toHaveValue('5');
  });

  it('uses default aria-labels when none is given', () => {
    render(<NumberStepper value={5} min={1} max={15} onChange={() => {}} />);
    expect(screen.getByLabelText('decrement')).toBeInTheDocument();
    expect(screen.getByLabelText('increment')).toBeInTheDocument();
  });

  it('steps once on a quick press without repeating', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const button = screen.getByLabelText('数を増やす');
    fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(6);
    vi.useRealTimers();
  });

  it('repeats while the pointer is held down past the initial delay', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const button = screen.getByLabelText('数を増やす');
    fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
    expect(onChange).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400);
    vi.advanceTimersByTime(80 * 3);
    expect(onChange).toHaveBeenCalledTimes(4);
    fireEvent.pointerUp(button);
    vi.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it('stops repeating once the held value reaches the max', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={13}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const button = screen.getByLabelText('数を増やす');
    fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
    vi.advanceTimersByTime(400);
    vi.advanceTimersByTime(80 * 10);
    expect(onChange).toHaveBeenCalledTimes(2); // 13 -> 14 -> 15, then auto-stops
    expect(onChange).toHaveBeenLastCalledWith(15);
    vi.useRealTimers();
  });

  it('ignores other keys while editing', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('数');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.keyDown(input, { key: 'a' });
    expect(input).toHaveValue('7');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reverts the draft and blurs on Escape', () => {
    const onChange = vi.fn();
    render(
      <NumberStepper
        ariaLabel="数"
        value={5}
        min={1}
        max={15}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('数');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '99' } });
    expect(input).toHaveValue('99');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('5');
    expect(onChange).not.toHaveBeenCalled();
    expect(input).not.toHaveFocus();
  });
});
