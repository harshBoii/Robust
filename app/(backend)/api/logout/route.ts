import { logoutJsonResponse } from '@/lib/auth/logout-response';

export async function POST() {
  return logoutJsonResponse();
}
