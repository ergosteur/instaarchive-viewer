import type { Transition } from 'motion/react';

/**
 * Shared motion vocabulary, tuned to feel like a native iOS app.
 *
 * Two rules do most of the work:
 *  - UIKit animates with springs, not fixed-duration easing, so gestures hand
 *    their exit velocity to the animation and motion continues rather than
 *    restarting.
 *  - iOS springs are critically damped. They settle firmly with no visible
 *    bounce; overshoot reads as "web animation", not "native".
 */

/** The curve UIKit uses for sheet presentation. */
export const IOS_EASE = [0.32, 0.72, 0, 1] as const;

/** Moving between peers: carousel slides, next/previous post. */
export const NAVIGATE: Transition = { type: 'spring', stiffness: 420, damping: 40, mass: 1 };

/** Presenting or dismissing a surface. Slightly softer than navigation. */
export const PRESENT: Transition = { type: 'spring', stiffness: 320, damping: 34, mass: 1 };

/** Backdrops and cross-fades, where a spring would feel fussy. */
export const FADE: Transition = { duration: 0.28, ease: IOS_EASE };

/** Touch-down feedback. Fast enough to feel like a direct response. */
export const PRESS: Transition = { type: 'spring', stiffness: 600, damping: 30 };

/**
 * Continue a drag into its animation.
 *
 * Handing the gesture's exit velocity to the spring is what separates "the
 * sheet kept moving because I flicked it" from "the sheet started a new
 * animation once I let go".
 */
export const withVelocity = (velocity: number, base: Transition = NAVIGATE): Transition => ({
  ...base,
  velocity,
});

/** True when the viewer has asked the OS to reduce motion. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
