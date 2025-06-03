# Custom React Hooks Directory

## Purpose

This directory is dedicated to storing custom React hooks used within the client application. React hooks are functions that allow you to "hook into" React state and lifecycle features from function components. Custom hooks enable the extraction and reuse of component logic, promoting cleaner and more maintainable code.

## Important Files

This directory contains various custom hook files. Each file typically exports a single hook function. Current hooks include:

- **`use-mobile.tsx`**: A hook likely used to detect if the application is being viewed on a mobile device. It might check the screen width or user agent.
- **`use-toast.ts`**: A hook that probably provides a convenient way to display toast notifications (small, temporary messages) to the user, integrating with a toast library or system.

As the application grows, more custom hooks might be added here to encapsulate other shared functionalities.

## Interaction

Custom hooks in this directory encapsulate reusable logic, stateful behavior, or side effects that can be shared across multiple components in the application. Instead of duplicating logic in several components, it can be extracted into a custom hook and then used wherever needed.

For example:
- `use-Mobile` might provide a boolean `isMobile` that components can use to render different layouts.
- `useToast` might expose a function `showToast(message, type)` that components can call to trigger notifications.

These hooks help keep components focused on their specific presentation concerns by abstracting away common stateful logic or side effects.

## Usage

Custom hooks are used by calling them within React function components or even other custom hooks. You import the hook and then call it like a regular function.

Here's a simple example of how you might import and use the `useMobile` hook within a React component:

```typescript jsx
import { useMobile } from '@/hooks/use-mobile'; // Assuming an alias '@' is configured for the 'src' directory

function MyResponsiveComponent() {
  const { isMobile } = useMobile();

  return (
    <div>
      {isMobile ? (
        <p>This is the mobile view.</p>
      ) : (
        <p>This is the desktop view.</p>
      )}
    </div>
  );
}

export default MyResponsiveComponent;
```

Similarly, for `useToast`:

```typescript jsx
import { useToast } from '@/hooks/use-toast';

function MyActionButton() {
  const { toast } = useToast(); // Assuming the hook returns an object with a toast function

  const handleClick = () => {
    // Do something
    toast({ title: "Action Complete!", description: "The action was successful." });
  };

  return <button onClick={handleClick}>Perform Action</button>;
}
```

Refer to the specific implementation of each hook to understand its return values and how to use them effectively.
The import path might vary based on project configuration (e.g., usage of path aliases like `@/`).
