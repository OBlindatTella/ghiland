/**
 * R3F runs useFrame subscribers in ascending priority, then the view.
 * The composer defaults to priority 1, so the camera must write earlier than 0.
 * DOM-projected windows then read this frame's camera instead of the previous one.
 */
export const CAMERA_FRAME_PRIORITY = -1;
