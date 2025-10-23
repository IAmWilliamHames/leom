// Import primitives from the Leom module
import {
  createSignal,
  createMemo,
  createEffect,
  createRoot,
} from '../src/leom.js'; // The source file is now named leom.js

// Helper function to create the DOM structure (Idempotent for stability)
const setupDom = () => {
  let appRoot = document.getElementById('app');

  // Check if the root already contains content from a previous run
  if (appRoot && appRoot.querySelector('#inc-button')) {
    return {
      countSpan: appRoot.querySelector('#count-span'),
      isEvenSpan: appRoot.querySelector('#is-even-span'),
      incButton: appRoot.querySelector('#inc-button'),
      logMessage: appRoot.querySelector('#log-message'),
    };
  }

  // Only proceed to create the DOM if content is missing
  appRoot.style.cssText =
    'padding: 20px; max-width: 400px; margin: 50px auto; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';

  appRoot.innerHTML = `
        <h1 style="font-size: 1.5rem; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">Leom Reactive Core Demo</h1>
        <p style="font-size: 1.25rem;">Count: <span id="count-span" style="font-weight: bold; color: #10B981;">0</span></p>
        <p style="font-size: 1.25rem;">Is Even?: <span id="is-even-span" style="font-weight: bold; color: #3B82F6;">True</span></p>
        <button id="inc-button" style="padding: 10px 20px; background-color: #3B82F6; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 15px; transition: background-color 0.2s;">
            Increment
        </button>
        <div id="log-message" style="margin-top: 20px; padding: 10px; border: 1px dashed #F59E0B; background-color: #FFFBEB; border-radius: 4px; display: none;"></div>
    `;

  // Retrieve the elements
  const elements = {
    countSpan: appRoot.querySelector('#count-span'),
    isEvenSpan: appRoot.querySelector('#is-even-span'),
    incButton: appRoot.querySelector('#inc-button'),
    logMessage: appRoot.querySelector('#log-message'),
  };

  return elements;
};

// --- Application Bootstrap ---
createRoot((disposeRoot) => {
  const { countSpan, isEvenSpan, incButton, logMessage } = setupDom();

  // 1. State
  const count = createSignal(0);

  // 2. Derived State (Memo)
  const isEven = createMemo(() => (count() % 2 === 0 ? 'True' : 'False'));

  // 3. Effects (DOM Updates)
  createEffect(() => {
    countSpan.textContent = count();
  });

  createEffect(() => {
    isEvenSpan.textContent = isEven();
    isEvenSpan.style.color = isEven() === 'True' ? '#10B981' : '#EF4444';
  });

  // Error Handling Test
  createEffect(() => {
    const currentCount = count();

    if (currentCount < 4) {
      logMessage.style.display = 'none';
      logMessage.textContent = '';
    }

    if (currentCount === 4) {
      logMessage.textContent =
        'CRITICAL ERROR: Check console for stack trace. System should continue running...';
      logMessage.style.display = 'block';
      throw new Error('Deliberate Effect Failure at count 4.');
    }
    if (currentCount === 5) {
      logMessage.textContent =
        'System recovered: The reactive graph is stable.';
      logMessage.style.display = 'block';
    }
    if (currentCount > 5) {
      logMessage.style.display = 'none';
    }
  });

  // 4. Event Handler
  incButton.addEventListener('click', () => {
    const newCount = count() + 1;
    count(newCount);

    if (newCount > 10) {
      console.log(
        'Count exceeded 10. Disposing the entire application root context.'
      );
      incButton.disabled = true;
      disposeRoot();
    }
  });
});
