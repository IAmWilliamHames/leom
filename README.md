# Leom

A minimal, high-performance reactive core for building user interfaces.  

Leom is a tiny JavaScript module that provides a powerful, fine-grained reactive engine. It is not a framework and does not use a Virtual DOM. Instead, it gives you a small set of tools ("primitives") to create state that, when changed, surgically updates only the parts of your application that depend on it.  

## Fine-Grained Reactivity

Leom is built on the "Signal" pattern. Unlike frameworks that re-run entire component functions and diff a Virtual DOM, Leom builds a graph of your reactive state. When you update a signal, it knows exactly which specific effect (like a DOM update) needs to re-run.  

This approach is inherently fast, as updates are direct and "surgical" with no VDOM overhead. The entire engine is contained in a single, simple file with no dependencies. Its API is easy to learn, updates are automatically batched for efficiency, and individual effects are error-bounded, so a failure in one computation won't crash the entire reactive graph.  

## Quick Start: A Counter Example

This example demonstrates the core primitives working together.  

### 1. Your HTML (`index.html`)
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Leom Demo</title>
  </head>
  <body>
    <div id="app">
        <p>Count: <span id="count-span">0</span></p>
        <p>Is Even?: <span id="is-even-span">True</span></p>
        <button id="inc-button">Increment</button>
    </div>

    <!-- Load your script as a module -->
    <script type="module" src="app.js"></script>
  </body>
</html>
```

### 2. Your JavaScript (`app.js`)
```js
// Import the primitives from Leom
import {
  createSignal,
  createMemo,
  createEffect,
  createRoot,
} from './src/leom.js';

// Get your DOM elements
const countSpan = document.getElementById('count-span');
const isEvenSpan = document.getElementById('is-even-span');
const incButton = document.getElementById('inc-button');

// createRoot manages the lifecycle of all reactive code inside it
createRoot((dispose) => {
  // 1. Create a reactive state "signal"
  const count = createSignal(0);

  // 2. Create "derived state" that caches its value
  const isEven = createMemo(() => (count() % 2 === 0 ? 'True' : 'False'));

  // 3. Create an "effect" that updates the count DOM
  createEffect(() => {
    // This effect "subscribes" to count()
    countSpan.textContent = count();
  });

  // 4. Create another effect that updates the isEven DOM
  createEffect(() => {
    // This effect "subscribes" to isEven()
    isEvenSpan.textContent = isEven();
  });

  // 5. Use a plain event listener to update the state
  incButton.addEventListener('click', () => {
    // Call the signal as a setter to update the value
    count(count() + 1);
  });
  
  // You can also call dispose() to stop all effects
});
```

When the `incButton` is clicked, `count` is updated, which automatically causes `isEven` to re-calculate and bot `createEffect` functions to re-run, updating the DOM.  

## API Primitives

Leom's power come from four main function (and one utility).  

### `createSignal(initialValue)`
This is the foundation of your state. It creates a reactive value store and returns a single function that acts as both a getter (`mySignal()`) and a setter (`mySignal(newValue)`). When called as a getter, it tracks itself as a dependency. When called as a setter, it notifies all it subscribers to update.  

### `createEffect(fn)`

This is the "do-er" of the system, perfect for updating the DOM or logging. It creates a reactive computation that runs immediately, automatically tracks any signals read inside it as dependencies, and re-runs whenever those dependencies change.  

### `createMemo(fn)`

This creates a cached, computed value derived from other signals. A memo only recomputes its value when its own dependencies change, making it highly efficient for expensive computations. Reading a memo is just like reading a signal.  

### `createRoot(gn)`

This function creates a reactive context that manages the lifecycle of nested computations. It provides a `dispose` function to its callback, which, when called, will stop and clean up all effects and memos created within that root, preventing memory leaks.  

### `onCleanup()`

This is a utility that registers a cleanup function (like clearing an interval or removing an event listener) to be called just before the current effect or root is re-run or disposed.  
