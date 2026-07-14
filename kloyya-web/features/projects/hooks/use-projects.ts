'use client';

import { useQuery } from '@tanstack/react-query';
import { services } from '@/services';
import { isApiError } from '@/services/http/errors';

export function useProjects() {
  return useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => services.projects.listProjects(),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn: () => services.projects.getProject(id),
    retry: (failureCount, error) =>
      !(isApiError(error) && !error.isRetryable) && failureCount < 2,
  });
}

/**
 * The health analysis. A 404 means "no analysis", which is expected for a steady
 * project — treated as data (`null`) so the detail page renders without one.
 */
export function useProjectHealth(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['projects', 'health', projectId],
    queryFn: async () => {
      try {
        return await services.projects.getHealth(projectId);
      } catch (error) {
        if (isApiError(error) && error.httpStatus === 404) return null;
        throw error;
      }
    },
    enabled,
  });
}
