/** Silk deceleration — no snap at the end. */
export const SESSION_EASE = [0.33, 1, 0.68, 1] as const;

/** Gentle spring — settles without bounce. */
export const SESSION_SPRING = {
  type: "spring" as const,
  stiffness: 62,
  damping: 22,
  mass: 1,
};

export const sessionSceneEnter = {
  initial: { opacity: 0, scale: 1.028, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: { duration: 1, delay: 0.12, ease: SESSION_EASE },
};

export const sessionTopBarEnter = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.75, delay: 0.38, ease: SESSION_EASE },
};

export const sessionPanelsEnter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay: 0.2, ease: SESSION_EASE },
};

export const sessionWelcomeContainer = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.11, delayChildren: 0.42 },
  },
};

export const sessionWelcomeItem = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: SESSION_EASE },
  },
};
