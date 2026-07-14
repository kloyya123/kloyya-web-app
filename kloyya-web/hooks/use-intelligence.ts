'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '@/services';
import type { DashboardData } from '@/services/intelligence/types';
import type { FeedbackRating, Recommendation, RecommendationOutcome } from '@/types/domain';

/**
 * The dashboard's server state.
 *
 * Shared rather than feature-local because the app shell reads the notification
 * list from the same payload. One query key means one request: TanStack dedupes
 * the shell's call and the page's call into a single fetch, and both re-render
 * from the same cache entry, so the bell badge can never disagree with the page.
 */
export const DASHBOARD_KEY = ['intelligence', 'dashboard'] as const;

export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => services.intelligence.getDashboard(),
  });
}

/**
 * Accept, dismiss, or postpone a recommendation.
 *
 * Optimistic: the card responds immediately, because Principle 14 says waiting
 * erodes confidence, and the user already decided. On failure the previous
 * snapshot is restored — an optimistic update that cannot roll back is a lie.
 */
export function useRecordOutcome() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: RecommendationOutcome }) =>
      services.intelligence.recordOutcome(id, outcome),

    onMutate: async ({ id, outcome }) => {
      // Stop an in-flight refetch from overwriting the optimistic value.
      await queryClient.cancelQueries({ queryKey: DASHBOARD_KEY });
      const previous = queryClient.getQueryData<DashboardData>(DASHBOARD_KEY);

      queryClient.setQueryData<DashboardData>(DASHBOARD_KEY, (current) =>
        current ? patchRecommendation(current, id, { outcome }) : current,
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(DASHBOARD_KEY, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}

export function useRecordFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: FeedbackRating }) =>
      services.intelligence.recordFeedback(id, rating),

    onMutate: async ({ id, rating }) => {
      await queryClient.cancelQueries({ queryKey: DASHBOARD_KEY });
      const previous = queryClient.getQueryData<DashboardData>(DASHBOARD_KEY);

      queryClient.setQueryData<DashboardData>(DASHBOARD_KEY, (current) =>
        current ? patchRecommendation(current, id, { feedbackRating: rating }) : current,
      );

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(DASHBOARD_KEY, context.previous);
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}

function patchRecommendation(
  data: DashboardData,
  id: string,
  changes: Partial<Recommendation>,
): DashboardData {
  return {
    ...data,
    recommendations: data.recommendations.map((rec) =>
      rec.id === id ? { ...rec, ...changes } : rec,
    ),
  };
}
