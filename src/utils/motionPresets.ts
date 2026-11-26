import type { Transition } from 'motion/react';

export const AROOS_EASE: [number, number, number, number] = [0.2, 0.9, 0.2, 1];

export const AROOS_BACKDROP_TRANSITION: Transition = {
  duration: 0.14,
  ease: AROOS_EASE,
};

export const AROOS_MODAL_TRANSITION: Transition = {
  duration: 0.16,
  ease: AROOS_EASE,
};

export const AROOS_PAGE_TRANSITION: Transition = {
  duration: 0.14,
  ease: AROOS_EASE,
};

export const AROOS_TAB_TRANSITION: Transition = {
  duration: 0.12,
  ease: AROOS_EASE,
};

export const AROOS_PAGE_VARIANTS = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const AROOS_TAB_VARIANTS = {
  initial: { opacity: 0, y: 5 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -3 },
};

export const AROOS_MODAL_VARIANTS = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.985, y: 6 },
};
