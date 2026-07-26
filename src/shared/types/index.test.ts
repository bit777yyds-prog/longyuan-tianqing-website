import { describe, expect, it } from 'vitest';
import { EventType, TaskStatus, RunMode } from './index.js';

describe('shared constants', () => {
  it('has deliverable submitted event type', () => {
    expect(EventType.DELIVERABLE_SUBMITTED).toBe('deliverable.submitted');
  });

  it('has open task status', () => {
    expect(TaskStatus.OPEN).toBe('open');
  });

  it('has replay run mode', () => {
    expect(RunMode.REPLAY).toBe('replay');
  });
});
