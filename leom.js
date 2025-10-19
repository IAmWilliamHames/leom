// Leom: Minimal Reactive Core Engine (ESM Module)

// CORE GLOBAL STATE AND UTILITIES

let currentEffect = null; // Tracks the currently executing effect/memo/root context.
const effectQueue = new Set(); // Queue for effects scheduled to run in the next microtask.
let isBatching = false; // Flag for microtask scheduling.

/**
 * Schedules an update for a given effect, using queueMicrotask for efficient batching.
 * @param {object} effect - The effect object (function with dependencies/state).
 */
export const scheduleUpdate = (effect) => {
  if (!effectQueue.has(effect)) {
    effectQueue.add(effect);
  }

  if (!isBatching) {
    isBatching = true;
    queueMicrotask(() => {
      isBatching = false;

      for (const eff of Array.from(effectQueue)) {
        effectQueue.delete(eff);

        if (eff.disposed) continue;

        // CYCLE DETECTION
        if (eff.running) {
          console.error(
            'Dependency Cycle Detected in Leom: An effect is trying to trigger itself synchronously. Skipping re-run.',
            eff
          );
          continue;
        }

        // ERROR BOUNDARY
        try {
          eff.running = true;
          eff();
        } catch (e) {
          console.error(
            'Leom Effect Execution Failed (Graceful Halt):',
            e.stack || e
          );
        } finally {
          eff.running = false;
        }
      }
    });
  }
};

/**
 * Registers a function to be called just before the current effect/root is re-run or disposed.
 * @param {function(): void} fn - The cleanup function.
 */
export const onCleanup = (fn) => {
  if (currentEffect) {
    currentEffect.cleanups.push(fn);
  } else {
    console.warn('Leom: onCleanup called outside a tracking context.');
  }
};

// REACTIVE PRIMITIVES

/**
 * Creates a reactive value and returns a getter/setter function.
 */
export const createSignal = (initialValue) => {
  let value = initialValue;
  const subscribers = new Set();

  const signal = function (newValue) {
    // SETTER LOGIC
    if (arguments.length > 0 && newValue !== value) {
      value = newValue;
      subscribers.forEach(scheduleUpdate);
    }

    // GETTER/TRACKING LOGIC
    if (currentEffect != null) {
      subscribers.add(currentEffect);
      currentEffect.dependencies.add(subscribers);
    }

    return value;
  };
  return signal;
};

/**
 * Executes a function, tracks dependencies, and re-runs when they change.
 */
export const createEffect = (fn) => {
  const effect = () => {
    effect.cleanups.forEach((c) => c());
    effect.cleanups.length = 0;
    effect.dependencies.forEach((depSet) => depSet.delete(effect));
    effect.dependencies.clear();

    const prevEffect = currentEffect;
    currentEffect = effect;
    try {
      fn();
    } finally {
      currentEffect = prevEffect;
    }
  };

  effect.dependencies = new Set();
  effect.cleanups = [];
  effect.disposed = false;
  effect.running = false;

  effect();

  // Dispose function
  return () => {
    if (effect.disposed) return;
    effect.disposed = true;
    effect.cleanups.forEach((c) => c());
    effect.dependencies.forEach((depSet) => depSet.delete(effect));
    effect.dependencies.clear();
    effectQueue.delete(effect);
  };
};

/**
 * Creates a cached, computed value (derived state).
 */
export const createMemo = (fn) => {
  let value;
  let initialized = false;
  const memoSubscribers = new Set();

  const memoEffect = () => {
    memoEffect.cleanups.forEach((c) => c());
    memoEffect.cleanups.length = 0;
    memoEffect.dependencies.forEach((depSet) => depSet.delete(memoEffect));
    memoEffect.dependencies.clear();

    const prevEffect = currentEffect;
    currentEffect = memoEffect;

    try {
      const newValue = fn();
      if (!initialized || newValue !== value) {
        value = newValue;
        initialized = true;
        memoSubscribers.forEach(scheduleUpdate);
      }
    } finally {
      currentEffect = prevEffect;
    }
  };

  memoEffect.dependencies = new Set();
  memoEffect.cleanups = [];
  memoEffect.disposed = false;
  memoEffect.running = false;

  memoEffect();

  const memoGetter = function () {
    if (currentEffect !== null) {
      memoSubscribers.add(currentEffect);
      currentEffect.dependencies.add(memoSubscribers);
    }
    return value;
  };

  return memoGetter;
};

/**
 * Creates a disposal context.
 */
export const createRoot = (fn) => {
  const rootCleanup = [];
  const rootContext = {
    cleanups: rootCleanup,
    dependencies: new Set(),
    disposed: false,
    running: false,
  };

  const prevEffect = currentEffect;
  currentEffect = rootContext;

  try {
    fn(() => dispose());
  } catch (e) {
    console.error('Leom: Error in createRoot function:', e.stack || e);
  } finally {
    currentEffect = prevEffect;
  }

  const dispose = () => {
    if (rootContext.disposed) return;
    rootContext.disposed = true;
    rootCleanup.forEach((c) => {
      try {
        c();
      } catch (e) {
        console.error('Leom: Error during root disposal cleanup:', e);
      }
    });
    rootCleanup.length = 0;
  };

  return dispose;
};
