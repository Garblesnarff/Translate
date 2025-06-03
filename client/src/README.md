# Client Source (`src`) Directory

## Purpose

This `src` directory is the heart of the client-side React application. It contains all the source code, assets, and configurations that constitute the front-end user interface and experience. The structure within `src` is designed to organize code logically, promoting modularity, reusability, and maintainability.

## Important Files/Directories

The key subdirectories and files within `src/` are:

- **`assets/`**: Stores static assets such as fonts, images, and other media files. See `assets/README.md` for more details.
- **`components/`**: Contains reusable React components. This includes both general application-specific components and a `ui/` subdirectory for foundational UI elements (likely from a library like Shadcn/UI). See `components/README.md` and `components/ui/README.md`.
- **`data_gathering_crew/`**: Houses the implementation of an AI-powered data gathering crew (e.g., using CrewAI), including its configuration, agent definitions, and main execution scripts. See `data_gathering_crew/README.md`.
- **`hooks/`**: Stores custom React hooks that encapsulate reusable stateful logic or side effects. See `hooks/README.md`.
- **`lib/`**: Contains utility functions, helper modules, client-side library configurations (like React Query), and wrappers for external services (like Gemini AI). See `lib/README.md`.
- **`pages/`**: Holds top-level React components that represent different pages or views in the application, typically mapped to specific URL routes. See `pages/README.md`.
- **`types/`**: Stores TypeScript type definitions and interfaces used throughout the application to ensure type safety. See `types/README.md`.

Key root files:

- **`main.tsx`**: This is the main entry point for the React application. It's responsible for rendering the root React component, setting up the router (likely `wouter`), and initializing any global context providers (like React Query's `QueryClientProvider`).
- **`index.css`**: Contains global CSS styles, base styling, and potentially CSS variable definitions that apply to the entire application. It might also import other CSS files (e.g., Tailwind CSS base styles).

## Interaction

The application is bootstrapped by `main.tsx`. This file typically:
1. Imports the root application component (often named `App` or directly uses page components with a router).
2. Sets up the routing mechanism (e.g., using `wouter`) to map URL paths to components from the `pages/` directory.
3. Wraps the application with necessary context providers (e.g., for state management, data fetching, theming).
4. Renders the application into the DOM.

The various modules within `src/` are highly interconnected:
- Page components (`pages/`) orchestrate the UI by importing and using components from `components/`.
- Components and pages utilize custom hooks (`hooks/`) for shared logic and side effects.
- Utility functions and service interactions are handled by modules in `lib/`.
- TypeScript types from `types/` are used across the entire codebase to define data structures and ensure type safety.
- Static assets from `assets/` are referenced in components or CSS.
- The AI crew in `data_gathering_crew/` might be interacted with via functions in `lib/` and its results displayed in components.

Global styles from `index.css` (and potentially other CSS files it imports, like Tailwind CSS) are applied throughout the application.

## Usage

The code within this `src/` directory is processed by a build tool, typically Vite (as suggested by the project structure with `main.tsx` as the entry point). Vite compiles the TypeScript/JSX code, bundles the JavaScript modules, processes CSS, and optimizes assets.

During development (`npm run dev` or `yarn dev`):
- Vite serves the application with Hot Module Replacement (HMR) for a fast development experience.

For production (`npm run build` or `yarn build`):
- Vite creates an optimized build in a `dist/` directory (usually in the `client/` root). These static assets (HTML, JavaScript, CSS) are then ready to be deployed to a web server or hosting platform.
