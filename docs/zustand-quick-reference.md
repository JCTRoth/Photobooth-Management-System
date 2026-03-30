# Zustand Quick Reference

## Installation

Zustand is already installed in the project. If you need to reinstall:
```bash
npm install zustand
```

## Current Stores

### 1. Auth Store (`@/store/authStore`)

**Import:**
```typescript
import { useAuth } from '@/hooks/useAuth';
```

**Common Usage:**
```typescript
// Get auth state
const { isAuthenticated, role, accessToken, eventId } = useAuth();

// Set auth after login
const { setAuth } = useAuth();
setAuth(token, 'Admin', eventId, eventName, mustChangePassword);

// Clear auth on logout
const { clearAuth } = useAuth();
clearAuth();

// Refresh token (called automatically)
const { refreshAccessToken } = useAuth();
await refreshAccessToken();
```

### 2. UI Store (`@/store/uiStore`)

**Import:**
```typescript
import { useUI } from '@/hooks/useUI';
```

**Common Usage:**
```typescript
// Show notifications
const { showSuccessNotification, showErrorNotification } = useUI();
showSuccessNotification('Operation completed!');
showErrorNotification('Something went wrong');

// Manage loading state
const { isLoading, setLoading } = useUI();
setLoading(true);

// Access current notification
const { notification } = useUI();
if (notification) {
  console.log(notification.message, notification.type);
}
```

## Creating a New Store

### Step 1: Define the Store (`src/store/myStore.ts`)
```typescript
import { create } from 'zustand';

interface MyStoreState {
  // State properties
  count: number;
  items: string[];
  
  // Methods
  increment: () => void;
  addItem: (item: string) => void;
}

export const useMyStore = create<MyStoreState>((set) => ({
  count: 0,
  items: [],
  
  increment: () => set((state) => ({ count: state.count + 1 })),
  addItem: (item: string) => set((state) => ({
    items: [...state.items, item]
  })),
}));
```

### Step 2: Create Custom Hook (`src/hooks/useMyStore.ts`)
```typescript
import { useMyStore } from '@/store/myStore';

export function useMyStore() {
  return useMyStore();
}
```

### Step 3: Use in Component
```typescript
import { useMyStore } from '@/hooks/useMyStore';

export function MyComponent() {
  const { count, increment, items, addItem } = useMyStore();
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
    </div>
  );
}
```

## Adding Persistence

To persist store state to sessionStorage:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useMyStore = create<MyStoreState>()(
  persist(
    (set) => ({
      // ... store definition
    }),
    {
      name: 'my-store', // Storage key
      storage: sessionStorage, // or localStorage
    }
  )
);
```

## Optimization Tips

### Selector Pattern (avoid unnecessary re-renders)
```typescript
// ❌ Bad - component re-renders on ANY state change
const state = useAuth();

// ✅ Good - only re-renders when role changes
const role = useAuth((state) => state.role);
```

### Subscribe to Changes
```typescript
// In useEffect
useEffect(() => {
  const unsubscribe = useAuth.subscribe(
    (state) => state.role,
    (role) => {
      console.log('Role changed:', role);
    }
  );
  
  return unsubscribe;
}, []);
```

## Async Operations

### In Store
```typescript
export const useMyStore = create<MyStoreState>((set) => ({
  data: null,
  loading: false,
  
  fetchData: async () => {
    set({ loading: true });
    try {
      const response = await fetch('/api/data');
      const data = await response.json();
      set({ data });
    } finally {
      set({ loading: false });
    }
  },
}));
```

### In Component
```typescript
export function MyComponent() {
  const { data, loading, fetchData } = useMyStore();
  
  useEffect(() => {
    fetchData();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  return <div>{JSON.stringify(data)}</div>;
}
```

## Debugging in Browser Console

```javascript
// Get entire store state
import('src/store/authStore').then(m => console.log(m.useAuthStore.getState()))

// Subscribe to all changes
useAuthStore.subscribe(() => console.log('State changed'))

// Get only specific field
const role = useAuthStore.getState().role
```

## Common Patterns

### Computed/Derived State
```typescript
interface StoreState {
  age: number;
  // ✅ Use computed property
  get isAdult() {
    return this.age >= 18;
  }
}
```

### Conditional State Setting
```typescript
set((state) => {
  if (condition) {
    return { field: newValue };
  }
  return state; // No changes
});
```

### Batch Updates
```typescript
set({
  count: count + 1,
  lastUpdate: new Date(),
  notification: { type: 'success', message: 'Updated!' }
});
```

## Troubleshooting

### Store not persisting
- Check that persist middleware is configured
- Verify storage key is set
- Check browser storage (DevTools > Application > Storage)

### Components not re-rendering on state change
- Verify you're using the hook (not `useStore.getState()` outside React)
- Check that new state actually differs from old state (immutability)
- Use selector pattern: `useStore((state) => state.field)`

### TypeScript errors
- Ensure state interface includes all properties
- Ensure all methods are defined in the store
- Check generic type: `create<YourInterface>((set) => (...))`

## File Locations
- Stores: `src/store/`
- Hooks: `src/hooks/`
- Types: `src/types/`
