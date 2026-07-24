import { describe, expect, it } from 'vitest';
import { detectIntent } from './intent';

describe('detectIntent', () => {
  it('recognizes explicit task creation phrasings', () => {
    expect(detectIntent('create a task to review the Q3 budget')).toEqual({
      type: 'create_task',
      title: 'review the Q3 budget',
    });
    expect(detectIntent('add task: follow up with legal')).toEqual({
      type: 'create_task',
      title: 'follow up with legal',
    });
    expect(detectIntent('new task - call the vendor')).toEqual({
      type: 'create_task',
      title: 'call the vendor',
    });
    expect(detectIntent('remind me to send the invoice')).toEqual({
      type: 'create_task',
      title: 'send the invoice',
    });
  });

  it('recognizes explicit project creation phrasings', () => {
    expect(detectIntent('create a project called Atlas Launch')).toEqual({
      type: 'create_project',
      title: 'Atlas Launch',
    });
    expect(detectIntent('start a new project: Website Redesign')).toEqual({
      type: 'create_project',
      title: 'Website Redesign',
    });
    expect(detectIntent('new project named Q4 Planning')).toEqual({
      type: 'create_project',
      title: 'Q4 Planning',
    });
  });

  it('strips surrounding quotes and trailing punctuation from the title', () => {
    expect(detectIntent('create a task "Ship the report."')).toEqual({
      type: 'create_task',
      title: 'Ship the report',
    });
  });

  it('returns null for ordinary questions', () => {
    expect(detectIntent('What did I miss this week?')).toBeNull();
    expect(detectIntent('Summarize my tasks for today')).toBeNull();
    expect(detectIntent('')).toBeNull();
  });

  it('returns null when the command has no title', () => {
    expect(detectIntent('create a task')).toBeNull();
    expect(detectIntent('new project')).toBeNull();
  });
});
