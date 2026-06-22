# ChatDigest Development Guide

This guide outlines the commands, architecture, and coding guidelines for the ChatDigest codebase.

## Build and Development Commands

*   **Start Local Development Server**: `npm run dev`
*   **Build for Production**: `npm run build`
*   **Production Preview / Node Server**: `npm start`
*   **Type Check / Lint**: `npm run lint`
*   **Clean Build Artifacts**: `npm run clean`
*   **Test Netlify Functions Locally**: `npx netlify functions:serve`

## Codebase Architecture & Structure

*   **Stack**: React 19, TypeScript, Vite, Tailwind CSS, Node.js/Express, deployed on Netlify (serverless functions via `serverless-http`).
*   **Entry Points**:
    *   Client: [src/main.tsx](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/main.tsx) / [src/App.tsx](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/App.tsx)
    *   Server: [server.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/server.ts) — Express app wrapped by `serverless-http` via [netlify/functions/api.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/netlify/functions/api.ts). Routes are modularized under `src/server/routes/`.
*   **Server Routes** (`src/server/routes/`):
    *   [digest.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/server/routes/digest.ts): POST `/api/digest`
    *   [parseMedia.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/server/routes/parseMedia.ts): POST `/api/parse-media`
    *   [chat.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/server/routes/chat.ts): POST `/api/chat`
    *   [contradictions.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/server/routes/contradictions.ts): POST `/api/check-contradictions`
    *   [execSummary.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/server/routes/execSummary.ts): POST `/api/executive-summary`
    *   [playbook.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/server/routes/playbook.ts): POST `/api/playbook`
    *   [translate.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/server/routes/translate.ts): POST `/api/translate`
*   **Data Persistence & Firebase**:
    *   [src/db.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/db.ts): Manages client-side offline IndexedDB storage.
    *   [src/firebase.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/firebase.ts): Re-export shim for backward compatibility.
    *   `src/firebase/` Modules:
        *   [init.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/firebase/init.ts): Firebase App initialization, DB / Auth services, error utilities.
        *   [auth.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/firebase/auth.ts): Authentication functions (`signInWithGoogle`, `signOutUser`, etc.).
        *   [firestoreDigests.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/firebase/firestoreDigests.ts): CRUD operations against Firestore (`users/{uid}/digests/{digestId}`).
*   **State Hooks**:
    *   [src/hooks/useDigestStorage.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/hooks/useDigestStorage.ts): Handles digest CRUD operations, auth subscriptions, active digest selection, and local/firestore sync logic.
*   **Frontend UI & Components**:
    *   [src/components/Dashboard.tsx](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/components/Dashboard.tsx): Main dashboard orchestrator (manages UI state and action handlers).
    *   `src/components/dashboard/`: Contains specialized sub-components (e.g. `TimelineColumn.tsx`, `PlaybookSection.tsx`, `ChatAssistant.tsx`, etc.).
*   **Core Logic**:
    *   [src/parser.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/parser.ts): Chat export parser for WhatsApp `.txt` files.
*   **Localization**:
    *   [src/lib/translations.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/lib/translations.ts): Dictionary of UI strings for `en` and `nl`.

## Coding Style & Guidelines

1.  **File Length Limit**: Keep files focused and modular. **Never let any file exceed 300 lines.** If a file grows beyond 300 lines, proactively refactor it by splitting it into smaller, single-responsibility modules.
2.  **TypeScript Standards**: Use strict type definitions. Avoid using `any` unless absolutely necessary (like intercepting raw network payloads).
3.  **State Management**: React state hook updates should be performed locally and immediately (optimistic updates where applicable) rather than refetching data from IndexedDB or Firestore, preventing race conditions.
4.  **Tailwind & UI**:
    *   Use modern Tailwind classes.
    *   Avoid hardcoded magic numbers or custom colors; rely on defined Tailwind theme classes and variables in [src/index.css](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/index.css).
    *   Ensure hover states degrade gracefully on touch devices.
5.  **Security Rules**: Firestore security rules are defined in [firestore.rules](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/firestore.rules). Any modifications to collection routes must update the security rules accordingly.
6.  **API Error Handling**: Never assume a failed `Response` contains JSON. Always use a safe fallback pattern (like `handleResponseError` in `useDigestStorage.ts` or `UploadZone.tsx`) consistently for every `!response.ok` block.
7.  **Netlify Serverless Routing**: A path-rewriting middleware at the top of `createExpressApp()` in [server.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/server.ts) strips the `/.netlify/functions/api` prefix. Do not remove this middleware.
8.  **Language Support**: All API routes accept a `language` field (`"en"` or `"nl"`). Gemini prompts must inject `langInstruction` into prompt text and the `responseSchema` field descriptions.
9.  **AI Models**: Always use `"gemini-3.5-flash"` as the primary Gemini AI model of choice for all generation, chat, translation, and analysis routes.
