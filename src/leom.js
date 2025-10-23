/**
 * @file Leom - A minimal reactive core engine for building user interfaces.
 * @author William Hames
 * @version 1.0.0
 */

// CORE GLOBAL STATE AND UTILITIES

/**
 * Tracks the currently executing effect, memo, or root context.
 * @private
 * @type {object|null}
 */
let currentEffect = null;

/**
 * A queue for effects that are scheduled to run in the next microtask.
 * @private
 * @type {Set<object>}
 */
const effectQueue = new Set();

/**
 * A flag to indicate if a microtask for batching updates is currently scheduled.
 * @private
 * @type {boolean}
 */
let isBatching = false;

/**
 * Schedules an update for a given effect, using `queueMicrotask` for efficient batching.
 * This prevents unnecessary re-renders by collecting all changes within a single event loop tick
 * and executing them together.
 * @param {object} effect - The effect object, which is a function with dependencies and state.
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
 * Registers a cleanup function to be called just before the current effect or root is re-run or disposed.
 * This is useful for clearing intervals, removing event listeners, or any other teardown logic.
 * @param {function(): void} fn - The cleanup function to register.
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
 * Creates a reactive value store (a "signal") and returns a single function to get and set its value.
 * When the signal's value changes, any effects or memos that depend on it are automatically re-run.
 * @param {*} initialValue - The initial value of the signal.
 * @returns {function(*=): *} A function that acts as a getter when called with no arguments,
 * and a setter when called with one argument.
 * @example
 * const count = createSignal(0); // Create a signal with initial value 0
 * count(); // Returns 0
 * count(5); // Sets the value to 5
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
 * Creates a reactive computation that automatically tracks its dependencies and re-runs
 * whenever any of those dependencies change.
 * @param {function(): void} fn - The function to execute. This function will be tracked for dependencies.
 * @returns {function(): void} A dispose function that can be called to stop the effect and clean up its dependencies.
 * @example
 * const count = createSignal(0);
 * createEffect(() => {
 *   console.log('The count is:', count());
 * });
 * // This will log "The count is: 0" initially, and then re-log whenever count changes.
 */
export const createEffect = (fn) => {
  const effect = () => {
    // Cleanup previous execution
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

  effect(); // Initial run

  // Return a dispose function
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
 * Creates a cached, computed value that is derived from other reactive signals or memos.
 * The memo's value is only recomputed when its dependencies change.
 * @param {function(): *} fn - The function that computes the value.
 * @returns {function(): *} A getter function to retrieve the memo's current value.
 * @example
 * const firstName = createSignal('John');
 * const lastName = createSignal('Doe');
 * const fullName = createMemo(() => `${firstName()} ${lastName()}`);
 * console.log(fullName()); // "John Doe"
 */
export const createMemo = (fn) => {
  let value;
  let initialized = false;
  const memoSubscribers = new Set();

  const memoEffect = () => {
    // Cleanup and dependency management similar to createEffect
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

  memoEffect(); // Initial computation

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
 * Creates a reactive context that manages the lifecycle of nested effects and memos.
 * When the root is disposed, all computations within it are also cleaned up.
 * This is useful for mounting and unmounting components.
 * @param {function(function(): void): void} fn - A function that receives a `dispose` function as its argument.
 * @returns {function(): void} A dispose function to clean up the entire root context.
 */
export const createRoot = (fn) => {
  const rootCleanup = [];
  const rootContext = {
    cleanups: rootCleanup,
    dependencies: new Set(), // Roots don't have dependencies, but the structure is consistent
    disposed: false,
    running: false,
  };

  const prevEffect = currentEffect;
  currentEffect = rootContext;

  try {
    fn(dispose); // Pass the dispose function to the user's setup code
  } catch (e) {
    console.error('Leom: Error in createRoot function:', e.stack || e);
  } finally {
    currentEffect = prevEffect;
  }

  function dispose() {
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
  }

  return dispose;
};