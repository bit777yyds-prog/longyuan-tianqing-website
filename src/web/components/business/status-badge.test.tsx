import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../ui/status-badge';

describe('StatusBadge', () => {
  it('renders open status with success color', () => {
    render(<StatusBadge status="open" />);
    const badge = screen.getByText('开放申请');
    expect(badge).toHaveClass('text-status-success');
  });

  it('renders under_review status with warning color', () => {
    render(<StatusBadge status="under_review" />);
    const badge = screen.getByText('验收中');
    expect(badge).toHaveClass('text-status-warning');
  });

  it('renders rework status with risk color', () => {
    render(<StatusBadge status="rework" />);
    const badge = screen.getByText('需返工');
    expect(badge).toHaveClass('text-status-risk');
  });

  it('renders running status with info color', () => {
    render(<StatusBadge status="running" />);
    const badge = screen.getByText('运行中');
    expect(badge).toHaveClass('text-status-info');
  });

  it('renders closed status with neutral color', () => {
    render(<StatusBadge status="closed" />);
    const badge = screen.getByText('已关闭');
    expect(badge).toHaveClass('text-status-neutral');
  });
});
