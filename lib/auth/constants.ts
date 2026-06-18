/** HttpOnly cookie storing the session JWT */
export const AUTH_COOKIE_NAME = "robust_session";

/** HttpOnly cookie for superadmin JWT (env credentials) */
export const SUPERADMIN_COOKIE_NAME = "robust_superadmin";

/** Default route for visitors without a valid session */
export const UNAUTHENTICATED_REDIRECT_PATH = "/landing";
