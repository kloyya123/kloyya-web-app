import type { SearchDoc } from '@/types/search';
import {
  mockEmails,
  mockKnowledgeArticles,
  mockMeetings,
  mockProjects,
  mockRecommendations,
  mockTasks,
  mockTeammates,
  mockUser,
} from './organization';

/**
 * The search index — the searchable projection of the one coherent dataset.
 *
 * Built from the same records every screen reads, so a search hit and the page
 * it opens can never disagree. Every doc carries a real href; nothing is indexed
 * that has nowhere to go.
 */

const people = [mockUser, ...mockTeammates];

export const mockSearchIndex: SearchDoc[] = [
  ...mockTasks.map<SearchDoc>((task) => ({
    id: task.id,
    kind: 'task',
    title: task.title,
    subtitle: `Task · ${task.priority}`,
    href: '/tasks',
    keywords: [task.status, task.priority, task.projectId ?? ''],
  })),

  ...mockMeetings.map<SearchDoc>((meeting) => ({
    id: meeting.id,
    kind: 'meeting',
    title: meeting.title,
    subtitle: meeting.summary === null ? 'Upcoming meeting' : 'Past meeting',
    href: `/meetings/${meeting.id}`,
    keywords: meeting.participants.map((p) => p.fullName),
  })),

  ...mockEmails.map<SearchDoc>((email) => ({
    id: email.id,
    kind: 'email',
    title: email.subject,
    subtitle: `Email · ${email.senderName}`,
    href: `/inbox/${email.id}`,
    keywords: [email.senderName, email.senderEmail],
  })),

  ...mockProjects.map<SearchDoc>((project) => ({
    id: project.id,
    kind: 'project',
    title: project.name,
    subtitle: `Project · ${project.status.replace('_', ' ')}`,
    href: `/projects/${project.id}`,
    keywords: [project.status],
  })),

  ...people.map<SearchDoc>((user) => ({
    id: user.id,
    kind: 'person',
    title: user.fullName,
    subtitle: user.jobTitle,
    href: `/organization/${user.id}`,
    keywords: [user.role, user.email],
  })),

  ...mockKnowledgeArticles.map<SearchDoc>((article) => ({
    id: article.id,
    kind: 'article',
    title: article.title,
    subtitle: `${article.category} · knowledge`,
    href: `/knowledge/${article.id}`,
    keywords: article.tags,
  })),

  ...mockRecommendations.map<SearchDoc>((rec) => ({
    id: rec.id,
    kind: 'recommendation',
    title: rec.title,
    subtitle: `Recommendation · ${rec.priority}`,
    href: '/recommendations',
    keywords: [rec.risk],
  })),
];
