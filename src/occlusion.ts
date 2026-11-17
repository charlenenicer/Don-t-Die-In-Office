/**
 * Sample points on the player that must always be visible from main's camera:
 * a wall that any line from the camera to one of these crosses is hidden.
 * main cast one row of rays at chest height (1.2) at -0.7 / 0 / +0.7 across; we add
 * feet and head rows so a low sill or a door lintel can't cover them either.
 */
export const OCCLUSION_HEIGHTS = [0.3, 1.2, 1.9] as const;
export const OCCLUSION_LATERALS = [-0.7, 0, 0.7] as const;
