import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('renders primary variant with correct classes', () => {
    render(<Button variant="primary">Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button).toHaveClass('bg-celadon-900');
    expect(button).toHaveClass('text-surface');
  });

  it('renders secondary variant with correct classes', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button).toHaveClass('bg-surface');
    expect(button).toHaveClass('text-celadon-900');
  });

  it('renders danger variant with correct classes', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button', { name: 'Danger' });
    expect(button).toHaveClass('text-kiln-700');
    expect(button).toHaveClass('border-kiln-700');
  });

  it('sets aria-busy when loading', () => {
    render(<Button isLoading>Loading</Button>);
    const button = screen.getByRole('button', { name: 'Loading' });
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
  });
});
