# Zustand State Management Integration

This document explains the Zustand state management system integration in the Photobooth Management System web application.

## Overview

The web application uses **Zustand** as its primary state management library. Zustand is a lightweight, performant state management solution for React that's much simpler than Redux while being more powerful than Context API alone.

## Why Zustand?

- **Lightweight**: Minimal bundle size overhead
- **Simple API**: Easier to use and understand compared to Redux
- **Type-safe**: Full TypeScript support
- **No boilerplate**: Less code to write and maintain
- **Performance**: Automatic optimization and subscriptions
- **Persistence**: Built-in middleware for localStorage/sessionStorage

## Store Structure

### Auth Store (`src/store/authStore.ts`)

Manages authentication state including user tokens, roles, and auth-related methods.

**State:**
- `accessToken`: User's JWT access token
- `role`: User's role (Admin or MarriageUser)
- `eventId`: Associated event ID (for marriage users)
- `eventName`: Associated event name
- `mustChangePassword`: Flag indicating password change requirement
- `isAuthenticated`: Computed authentication state

**Methods:**
- `setAuth()`: Set authentication state after successful login
- `clearAuth()`: Clear auth state on logout
- `refreshAccessToken()`: Refresh the access token (automatic every 14 minutes)

**Usage:**
```typescript
import { useAuth } from '@/hooks/useAuth';

export function MyComponent() {
  const { isAuthenticated, role, setAuth, clearAuth } = useAuth();
  
  if (!isAuthenticated) return <div>Not logged in</div>;
  
  return <div>Logged in as {role}</div>;
}
```

### UI Store (`src/store/uiStore.ts`)

Manages global UI state like loading indicators and notifications.

**State:**
- `isLoading`: Global loading state
- `notification`: Current notification with message and type

**Methods:**
- `setLoading()`: Set the loading state
- `setNotification()`: Show a notification (with auto-clear after 5s)
- `showSuccessNotification()`: Show a success notification
- `showErrorNotification()`: Show an error notification
- `showInfoNotification()`: Show an info notification
- `showWarningNotification()`: Show a warning notification

**Usage:**
```typescript
import { useUI } from '@/hooks/useUI';

export function MyComponent() {
  const { showSuccessNotification, setLoading } = useUI();
  
  async function handleSubmit() {
    setLoading(true);
    try {
      // ... operation ...
      showSuccessNotification('Operation completed!');
    } finally {
      setLoading(false);
    }
  }
  
  return <button onClick={handleSubmit}>Submit</button>;
}
```

## Custom Hooks

### `useAuth()` (`src/hooks/useAuth.ts`)

Wrapper hook around the auth store. Provides a convenient interface for accessing auth state and methods.

```typescript
import { useAuth } from '@/hooks/useAuth';

const { 
  accessToken, 
  role, 
  isAuthenticated, 
  setAuth, 
  clearAuth,
  refreshAccessToken 
} = useAuth();
```

### `useUI()` (`src/hooks/useUI.ts`)

Wrapper hook around the UI store. Provides convenient access to UI state and notification methods.

```typescript
import { useUI } from '@/hooks/useUI';

const { 
  isLoading, 
  notification,
  showSuccessNotification,
  showErrorNotification 
} = useUI();
```

## Migration from Context API

The old `AuthContext` has been replaced with Zustand. If you see any imports from `@/context/AuthContext`, they should be updated to use `@/hooks/useAuth` instead.

### Before (Context API):
```typescript
import { useAuth } from '@/context/AuthContext';
import { AuthProvider } from '@/context/AuthContext';

// In App.tsx
<AuthProvider>
  <App />
</AuthProvider>
```

### After (Zustand):
```typescript
import { useAuth } from '@/hooks/useAuth';

// No provider needed - Zustand handles everything!
```

## Persistence

The auth store automatically persists to `sessionStorage` using Zustand's persist middleware:
- Only auth-related state is persisted
- Uses `sessionStorage` instead of `localStorage` (clears on browser close)
- Automatically restores on page reload

## Token Refresh

The app automatically refreshes the access token every 14 minutes (token lifetime is 15 minutes). This is configured in `App.tsx` in the `ApiConfigurer` component.

## Adding New Stores

To add a new Zustand store:

1. **Create the store file** (`src/store/newStore.ts`):
```typescript
import { create } from 'zustand';

interface NewStoreState {
  count: number;
  increment: () => void;
}

export const useNewStore = create<NewStoreState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

2. **Create a custom hook** (`src/hooks/useNewStore.ts`):
```typescript
import { useNewStore } from '@/store/newStore';

export function useNewStore() {
  const { count, increment } = useNewStore();
  return { count, increment };
}
```

3. **Use in components**:
```typescript
import { useNewStore } from '@/hooks/useNewStore';

export function MyComponent() {
  const { count, increment } = useNewStore();
  return (
    <div>
      Count: {count}
      <button onClick={increment}>Increment</button>
    </div>
  );
}
```

## Debugging

To debug Zustand stores in the browser:

```typescript
// In development, you can inspect store state
import { useAuthStore } from '@/store/authStore';

console.log(useAuthStore.getState()); // Get current state
useAuthStore.subscribe((state) => {
  console.log('State changed:', state); // Subscribe to changes
});
```

## Best Practices

1. **Keep stores focused**: Each store should handle a specific domain (auth, UI, etc.)
2. **Use custom hooks**: Always provide custom hooks as the public API
3. **Avoid unnecessary re-renders**: Zustand uses shallow equality by default - components only re-render when subscribed state changes
4. **Use selectors for optimization**:
```typescript
// Only re-render when role changes
const role = useAuth((state) => state.role);
```

5. **Handle async actions**: For API calls, use async functions within store methods or call APIs in components and update store
6. **Documentation**: Keep store types and methods well-documented

## Related Files

- Auth store: `src/store/authStore.ts`
- UI store: `src/store/uiStore.ts`
- Auth hook: `src/hooks/useAuth.ts`
- UI hook: `src/hooks/useUI.ts`
- Components updated: `src/components/RequireAuth.tsx`
- Pages updated: `src/pages/AdminLogin.tsx`, `AdminChangePassword.tsx`, `MyGallery.tsx`
- App root: `src/App.tsx`

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [TypeScript with Zustand](https://github.com/pmndrs/zustand/blob/main/docs/typescript.md)
- [Zustand Persist Middleware](https://github.com/pmndrs/zustand#persist-middleware)
