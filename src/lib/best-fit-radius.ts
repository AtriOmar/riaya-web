/**
 * Doctors beyond this radius (km) are excluded — prevents cross-city matches.
 * Kept apart from `best-fit.ts` (which reads the database) so client code,
 * like the admin call map, can draw the same radius.
 */
export const BEST_FIT_MAX_RADIUS_KM = 50;
