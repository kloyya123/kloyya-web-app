'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DASHBOARD_KEY } from '@/hooks/use-intelligence';
import { services } from '@/services';
import type { FeedbackRating, Recommendation, RecommendationOutcome } from '@/types/domain';

/**
 * The recommendation feed's server state.
 *
 * Its own query key, separate from the dashboard's, because the feed is wider —
 * it carries Medium items the dashboard filters out. Mutations patch this cache
 * optimistically and, on settle, invalidate *both* keys: the underlying record
 * is shared, so a decision made here must also refresh the dashboard, or the two
 * would disagree about whether you'd acted.
 */
export const FEED_KEY = ['intelligence', 'recommendations'] as const;

export function useRecommendations() {
  return useQuery({
    queryKey: FEED_KEY,
    queryFn: () => services.intelligence.listRecommendations(),
  });
}

function patch(list: Recommendation[], id: string, changes: Partial<Recommendation>) {
  return list.map((rec) => (rec.id === id ? { ...rec, ...changes } : rec));
}

function useFeedMutation<V>(
  mutationFn: (variables: V) => Promise<Recommendation>,
  toChanges: (variables: V) => Partial<Recommendation>,
  idOf: (variables: V) => string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: FEED_KEY });
      const previous = queryClient.getQueryData<Recommendation[]>(FEED_KEY);
      queryClient.setQueryData<Recommendation[]>(FEED_KEY, (current) =>
        current ? patch(current, idOf(variables), toChanges(variables)) : current,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(FEED_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: FEED_KEY });
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
  });
}

export function useRecordOutcome() {
  return useFeedMutation(
    ({ id, outcome }: { id: string; outcome: RecommendationOutcome }) =>
      services.intelligence.recordOutcome(id, outcome),
    ({ outcome }) => ({ outcome }),
    ({ id }) => id,
  );
}

export function useRecordFeedback() {
  return useFeedMutation(
    ({ id, rating }: { id: string; rating: FeedbackRating }) =>
      services.intelligence.recordFeedback(id, rating),
    ({ rating }) => ({ feedbackRating: rating }),
    ({ id }) => id,
  );
}
