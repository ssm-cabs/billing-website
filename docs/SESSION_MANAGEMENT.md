# Session Management Guide

This guide explains how login sessions are managed in the SSM Cabs Billing website.

## **How Sessions Work**

### **1. Session Persistence**
- **Firebase Auth** automatically handles session persistence using browser localStorage
- Users stay logged in between:
  - Page refreshes
  - Browser closing and reopening
  - Navigating between pages
- Session is tied to the browser - clearing browser data will log out the user

### **2. Session Checking**
Every protected page checks if a user is authenticated:

```javascript
// In useEffect on component mount
const user = getCurrentUser();
if (!user) {
  router.push("/login"); // Redirect to login if not authenticated
}
```

### **3. Session Storage Location**
Firebase stores session tokens in:
- `localStorage` (for persistence)
- `sessionStorage` (for current session)
- These are managed automatically by Firebase Auth SDK

## **Using Session Management**

### **Check Current User**

```javascript
import { getCurrentUser } from "@/lib/phoneAuth";

const user = getCurrentUser();
if (user) {
  console.log("Logged in as:", user.phoneNumber);
  console.log("User ID:", user.uid);
}
```

### **Get User Data from Firestore**

```javascript
import { getUserData } from "@/lib/phoneAuth";

const userData = await getUserData(user.phoneNumber);
console.log("User name:", userData.name);
console.log("User role:", userData.role);
```

### **Logout User**

```javascript
import { signOutUser } from "@/lib/phoneAuth";
import { useRouter } from "next/navigation";

const router = useRouter();

const handleLogout = async () => {
  await signOutUser();
  router.push("/login");
};
```

### **Protect a Page**

#### **Option 1: Using useAuth Hook**

```javascript
"use client";

import { useAuth } from "@/lib/useAuth";

export default function ProtectedPage() {
  const { user, userData, loading, isAuthenticated } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return null; // Hook redirects

  return (
    <div>
      <h1>Welcome, {userData?.name}</h1>
    </div>
  );
}
```

#### **Option 2: Using withAuth HOC**

```javascript
"use client";

import { withAuth } from "@/lib/useAuth";

function AdminPage({ user, userData }) {
  return (
    <div>
      <h1>Admin Panel</h1>
      <p>Logged in as: {userData?.name}</p>
    </div>
  );
}

export default withAuth(AdminPage);
```

### **Display User Info & Logout Button**

Use the `UserSession` component:

```javascript
import { UserSession } from "@/components/UserSession";

export default function Header() {
  return (
    <header>
      <h1>Dashboard</h1>
      <UserSession />
    </header>
  );
}
```

## **Session Flow**

```
1. User opens login page
   ↓
2. User enters phone + OTP
   ↓
3. Firebase Auth verifies
   ↓
4. Session token saved to localStorage
   ↓
5. User redirected to /dashboard
   ↓
6. Dashboard checks getCurrentUser()
   ↓
7. User data fetched from Firestore
   ↓
8. Dashboard displayed with user info
   ↓
9. User clicks Logout
   ↓
10. signOutUser() clears tokens
    ↓
11. User sent back to /login
```

## **Session Lifecycle**

### **Session Created**
- When user successfully verifies OTP
- Firebase creates authentication token
- Token stored in browser storage

### **Session Active**
- User can access protected pages
- Pages check `getCurrentUser()` returns valid user
- Firestore queries use user's phone number

### **Session Timeout**
- No automatic timeout (configured in Firebase Console)
- Token persists until:
  - User clicks Logout
  - Token expires (customizable)
  - Browser clears storage

### **Session Destroyed**
- User clicks Logout button
- `signOutUser()` called
- Token removed from storage
- Redux/state cleared
- User sent back to /login

## **Advanced: Custom Session Config**

### **Require Admin Role**

```javascript
export default withAuth(AdminPanel, { requireAdmin: true });
```

### **Redirect to Custom Page**

```javascript
const { user, userData } = useAuth({ redirectTo: "/login" });
```

### **Check Role Before Action**

```javascript
if (userData?.role === "admin") {
  // Show admin-only features
}

if (userData?.role === "driver") {
  // Show driver features
}
```

## **Debugging Session Issues**

### **Check Browser Storage**
Open Developer Tools (F12):
1. **Application** tab
2. **Local Storage**
3. Look for `firebase:...` keys
4. These contain session tokens

### **Check Console for Auth Events**
```javascript
import { getCurrentUser } from "@/lib/phoneAuth";

console.log("Current user:", getCurrentUser());
console.log("UID:", getCurrentUser()?.uid);
console.log("Phone:", getCurrentUser()?.phoneNumber);
```

### **Force Session Refresh**
```javascript
// Clear localStorage and reload
localStorage.clear();
window.location.reload();
```

## **Security Notes**

✅ **Sessions are secure because:**
- Tokens encrypted in browser storage
- Firebase SDK handles encryption
- Tokens expire (configurable)
- HTTPS required in production
- Each token tied to specific user

⚠️ **Session Security Tips:**
- Always use HTTPS in production
- Logout on untrusted devices
- Don't share tokens manually
- Implement inactivity timeout if needed
- Optional: Add role-based access control

## **Customizing Session Behavior**

### **Add Inactivity Timeout**

```javascript
// src/lib/useSessionTimeout.js
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOutUser } from "./phoneAuth";

export function useSessionTimeout(minutes = 30) {
  const router = useRouter();
  let timeoutId;

  const resetTimeout = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(async () => {
      await signOutUser();
      router.push("/login");
    }, minutes * 60 * 1000);
  };

  useEffect(() => {
    resetTimeout();
    window.addEventListener("mousemove", resetTimeout);
    window.addEventListener("keypress", resetTimeout);

    return () => {
      window.removeEventListener("mousemove", resetTimeout);
      window.removeEventListener("keypress", resetTimeout);
      clearTimeout(timeoutId);
    };
  }, [minutes, router]);
}
```

Usage:
```javascript
export default function Dashboard() {
  useSessionTimeout(30); // 30 minute inactivity timeout

  return <div>Dashboard content</div>;
}
```

## **Summary**

| Feature | How It Works |
|---------|------------|
| **Login** | Phone + OTP → Firebase creates token |
| **Persistence** | Token in localStorage → survives page refreshes |
| **Checking Auth** | `getCurrentUser()` → returns user or null |
| **Getting User Data** | Query Firestore with phone number |
| **Logout** | `signOutUser()` → clears token |
| **Page Protection** | useAuth hook → redirects if not logged in |
