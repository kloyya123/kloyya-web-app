import { API_STATUS, ApiError, errors } from '../http/errors';
import type { MemberChangeResult } from './members';

/** Turn a member-management refusal into the KAS error that explains it. */
export function memberChangeToApiError(
  result: Extract<MemberChangeResult, { ok: false }>,
): ApiError {
  switch (result.reason) {
    case 'target_is_senior':
      return new ApiError({
        httpStatus: API_STATUS.Forbidden,
        errorCode: 'target_is_senior',
        message: 'You cannot manage someone more senior than you.',
        description: 'That person holds a role above your own.',
        suggestedResolution: 'Ask an owner or administrator to make this change.',
      });
    case 'forbidden_role':
      return new ApiError({
        httpStatus: API_STATUS.Forbidden,
        errorCode: 'forbidden_role',
        message: 'You cannot grant a role more senior than your own.',
        description: 'Promoting someone past yourself is not permitted.',
        suggestedResolution: 'Choose a role at or below your own level.',
      });
    case 'last_owner':
      return new ApiError({
        httpStatus: API_STATUS.Conflict,
        errorCode: 'last_owner',
        message: 'An organization must keep an owner.',
        description:
          'This is the only owner; removing or demoting them would leave nobody able to administer the organization.',
        suggestedResolution: 'Make someone else an owner first, then try again.',
      });
    case 'not_found':
      return errors.notFound('Member');
    case 'no_profile':
      return errors.notFound('User profile');
  }
}
