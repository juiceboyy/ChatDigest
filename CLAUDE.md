# ChatDigest Development Guide

This guide outlines the commands and styling guidelines for the ChatDigest codebase.

## Build and Development Commands

*   **Start Local Development Server**: `npm run dev`
*   **Build for Production**: `npm run build`
*   **Production Preview / Node Server**: `npm start`
*   **Type Check / Lint**: `npm run lint`
*   **Clean Build Artifacts**: `npm run clean`

## Codebase Architecture & Structure

*   **Stack**: React 19, TypeScript, Vite, Tailwind CSS, Node.js/Express.
*   **Entry Points**:
    *   Client: [src/main.tsx](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/main.tsx) / [src/App.tsx](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/App.tsx)
    *   Server: [server.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/server.ts)
*   **Data Persistence**:
    *   [src/db.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/db.ts): Manages client-side offline IndexedDB storage (under database `ChatDigestPersistenceDB`).
    *   [src/firebase.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/firebase.ts): Manages Google Auth, Firestore sync (under path `users/{uid}/digests/{digestId}`), and safe local sandbox persistence fallback (`sandbox-guest-user-session`).
*   **Core Logic**:
    *   [src/parser.ts](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/parser.ts): Chat export parser for WhatsApp `.txt` files.

## Coding Style & Guidelines

1.  **TypeScript Standards**: Use strict type definitions. Avoid using `any` unless absolutely necessary (like intercepting raw network payloads).
2.  **State Management**: React state hook updates (`setDigests`, `setActiveDigest`) should be performed locally and immediately (optimistic updates where applicable) rather than refetching data from IndexedDB or Firestore, preventing race conditions.
3.  **Tailwind & UI**: 
    *   Use modern Tailwind classes.
    *   Avoid hardcoded magic numbers or custom colors; rely on defined Tailwind theme classes and variables in [src/index.css](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/src/index.css).
    *   Ensure hover states (`group-hover:`) degrade gracefully on touch devices by using screen prefixes or responsive layout configurations (e.g., `opacity-100 lg:opacity-0 lg:group-hover:opacity-100`).
4.  **Security Rules**: Firestore security rules are defined in [firestore.rules](file:///Volumes/T7%20Shield/Vibe%20Coding/ChatDigest/firestore.rules). Any modifications to collection routes must update the security rules accordingly.
