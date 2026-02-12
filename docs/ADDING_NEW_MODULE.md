# Adding a New Module to the Billing Website

This guide explains how to add a new module (e.g., "billing", "reports", etc.) to the application with full permission support.

## Step 1: Add Module Configuration

Edit `/src/config/modules.js` and add your new module to the `MODULES` array:

```javascript
export const MODULES = [
  // ... existing modules ...
  {
    id: "billing",                          // Unique identifier (used in database)
    name: "Billing",                        // Display name
    description: "Manage billing records",  // Short description
    path: "/billing",                       // Route path
    icon: "💰",                            // Icon/emoji for UI
  },
];
```

**That's it for configuration!** The permission system will automatically:
- Include "billing" in all user permission forms
- Create default permissions with "none" for new users
- Validate permissions against this module
- Show/hide dashboard quick actions based on permissions

## Step 2: Create the Module Page

Create `/src/app/billing/page.js`:

```javascript
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePermissions } from "@/lib/usePermissions";
import styles from "./billing.module.css";

export default function BillingPage() {
  // This hook automatically:
  // - Redirects to dashboard if permission is "none"
  // - Sets canView=true for "read" or "edit"
  // - Sets canEdit=true only for "edit"
  const { canView, canEdit, loading: permissionsLoading } = usePermissions("billing");
  
  const [data, setData] = useState([]);

  if (permissionsLoading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Loading permissions...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header>
        <Link href="/dashboard">← Back</Link>
        <h1>Billing</h1>
      </header>

      {/* Only show create form for users with edit permission */}
      {canEdit && (
        <section>
          <h2>Add New Billing Record</h2>
          <form onSubmit={handleSubmit}>
            {/* Your form fields */}
            <button type="submit">Save</button>
          </form>
        </section>
      )}

      {/* All users with read or edit can see the list */}
      <section>
        <h2>Billing Records</h2>
        {data.map((item) => (
          <div key={item.id}>
            <span>{item.name}</span>
            {/* Only show edit/delete for users with edit permission */}
            {canEdit && (
              <>
                <button onClick={() => handleEdit(item.id)}>Edit</button>
                <button onClick={() => handleDelete(item.id)}>Delete</button>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
```

## Step 3: Create Styles (Optional)

Create `/src/app/billing/billing.module.css`:

```css
.page {
  min-height: 100vh;
  padding: 120px 8vw 80px;
  background: var(--page-bg);
}
```

## Permission Levels Explained

### None
- User cannot access the module at all
- Automatic redirect to dashboard if they try to access via URL
- Module link hidden from dashboard quick actions

### Read
- User can view all data
- Cannot create, edit, or delete
- Create forms and action buttons are hidden
- Use: `if (canView) { /* show data */ }`

### Edit
- User has full access (view + create + edit + delete)
- All forms and buttons visible
- Use: `if (canEdit) { /* show create/edit/delete UI */ }`

## Automatic Features

When you add a module to the configuration, these features work automatically:

### ✅ Dashboard Quick Actions
- Module appears in quick actions if user has read or edit permission
- Shows module icon and name
- Links to module path

### ✅ User Management
- Permission control appears in user add/edit form
- Shows module icon and name
- Dropdown with None/Read/Edit options

### ✅ Permission Validation
- New users get "none" permission by default for all modules
- System validates that all modules have valid permissions (none/read/edit)

### ✅ Storage
- User permissions stored in Firestore `users` collection
- Permissions object like: `{ invoices: "edit", billing: "read", ... }`
- Cached in localStorage after login

## Advanced: Database Operations

If your module needs Firestore operations, create `/src/lib/billingApi.js`:

```javascript
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

export async function fetchBillingRecords() {
  const snapshot = await getDocs(collection(db, "billing"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function createBillingRecord(data) {
  return await addDoc(collection(db, "billing"), {
    ...data,
    created_at: new Date().toISOString(),
  });
}

export async function updateBillingRecord(id, data) {
  await updateDoc(doc(db, "billing", id), {
    ...data,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteBillingRecord(id) {
  await deleteDoc(doc(db, "billing", id));
}
```

## Security: Firestore Rules

Add Firestore security rules for your new collection in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /billing/{billingId} {
      // Helper function to check if user has permission
      function hasPermission(level) {
        let userData = get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
        return userData.permissions.billing == level || 
               (level == 'read' && userData.permissions.billing == 'edit');
      }
      
      // Read: requires 'read' or 'edit' permission
      allow read: if request.auth != null && hasPermission('read');
      
      // Write: requires 'edit' permission
      allow create, update, delete: if request.auth != null && hasPermission('edit');
    }
  }
}
```

## Testing Your New Module

1. **Create a test user** with different permission levels via `/users`
2. **Test "none" permission**: Should redirect to dashboard
3. **Test "read" permission**: Should see data but no create/edit/delete buttons
4. **Test "edit" permission**: Should have full access

## Summary

To add a new module:
1. Add one entry to `MODULES` array in `/src/config/modules.js`
2. Create the page component using `usePermissions` hook
3. Conditionally render UI based on `canView` and `canEdit`

That's it! The permission system handles everything else automatically.
