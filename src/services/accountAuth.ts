import { cvApiAuth } from '@/services/userApi';
import type { AccountAuth } from '@/types/account';

/**
 * Signing in: cv-api's Better Auth (src/services/cvApiAuth.ts, set up in
 * src/services/userApi.ts). AuthContext and the services ask this.
 */
export const accountAuth: AccountAuth = cvApiAuth;
