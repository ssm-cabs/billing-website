# Firebase Phone Authentication Setup Guide

This guide explains how to set up Firebase phone authentication with database user restrictions for the SSM Cabs Billing website.

## Prerequisites

- Firebase project already created at `billing-ssm-cabs`
- Firestore Database initialized
- Firebase Authentication enabled

## Step 1: Enable Phone Sign-In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **billing-ssm-cabs**
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Phone** and enable it
5. Save the changes

## Step 2: Create the `authorized_users` Collection

This collection stores all users who are allowed to log in.

1. Go to **Firestore Database**
2. Create a new collection named: `authorized_users`
3. Add documents with the following structure:

```json
{
  "phone": "+919876543210",
  "name": "Driver Name",
  "email": "driver@example.com",
  "role": "driver",
  "company_id": "acme-corp",
  "active": true,
  "created_at": "2026-02-12",
  "notes": "Optional notes"
}
```

### Required Fields:
- **phone** (String): Phone number with country code (e.g., `+919876543210`)
- **name** (String): User's full name
- **email** (String): User's email address
- **role** (String): User role (e.g., "driver", "admin", "manager")
- **active** (Boolean): Whether the account is active

### Optional Fields:
- **company_id** (String): Associated company ID
- **created_at** (String): Account creation date
- **notes** (String): Any additional information

## Step 3: Configure reCAPTCHA

1. In Firebase Console, go to **Authentication** → **Settings** → **reCAPTCHA Keys**
2. The site key should be automatically generated
3. In production, ensure you have the Web reCAPTCHA v2 keys configured

## Step 4: Update Next.js Configuration (if needed)

Make sure your `next.config.mjs` includes the Firebase domain in external images (if using Firebase Hosting):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

## Usage

### For Users

1. Navigate to `/login`
2. Enter your 10-digit Indian phone number (with or without +91)
3. Enter the 6-digit OTP sent to your phone
4. Successfully authenticated users are redirected to `/dashboard`

### For Administrators

#### Adding a New Authorized User

1. Go to Firestore Console
2. Open the `authorized_users` collection
3. Add a new document with the user's phone number and details

```bash
# Example using Firebase CLI
firebase firestore:bulk-load authorized_users.json
```

#### Bulk Upload (Using CSV to Import)

1. Prepare a CSV file with columns: `phone`, `name`, `email`, `role`, `active`
2. Use Firebase Console UI or write a script to import

Example import script:
```javascript
// scripts/importUsers.js
const admin = require('firebase-admin');

const users = [
  { phone: '+919876543210', name: 'Driver 1', email: 'driver1@example.com', role: 'driver', active: true },
  { phone: '+919876543211', name: 'Driver 2', email: 'driver2@example.com', role: 'driver', active: true },
];

async function importUsers() {
  for (const user of users) {
    await admin.firestore().collection('authorized_users').add(user);
  }
  console.log('Users imported successfully');
}

importUsers();
```

### Verify User Authorization

Edit `/dashboard/page.js` to verify user is authorized:

```javascript
import { getCurrentUser } from '@/lib/phoneAuth';
import { getUserData } from '@/lib/phoneAuth';

export default async function DashboardPage() {
  const user = getCurrentUser();
  
  if (!user) {
    return redirect('/login');
  }

  const userData = await getUserData(user.phoneNumber);
  
  if (!userData) {
    return redirect('/login');
  }

  // Show dashboard with userData
}
```

## How Authentication Works

1. **Phone Entry**: User submits their phone number
2. **Authorization Check**: System queries `authorized_users` collection for the phone number
3. **If Unauthorized**: User sees error message and blocks login attempt
4. **If Authorized**: OTP is sent via Firebase Phone Authentication
5. **OTP Verification**: User enters 6-digit code
6. **Redirect**: On success, user is logged in and redirected to dashboard

## Security Notes

- Only users in the `authorized_users` collection can log in
- Phone numbers must include country code (+91 for India)
- reCAPTCHA prevents bot abuse
- Firebase Auth handles secure token management
- Sessions persist in browser localStorage

## Troubleshooting

### "Phone number is not authorized"
- Verify the phone number is in the `authorized_users` collection
- Check exact format matches: `+919876543210` (with country code)

### "Failed to send OTP"
- Enable Phone Sign-In in Firebase Authentication settings
- Check reCAPTCHA is properly configured
- Verify Firebase project is correctly initialized

### "Invalid OTP"
- Ensure user enters exactly 6 digits
- OTP expires after 10 minutes
- User must request a new OTP if it expires

## Files Modified/Created

- `src/lib/firebase.js` - Updated with Auth initialization
- `src/lib/phoneAuth.js` - New phone authentication utilities
- `src/app/login/page.js` - New login page with phone auth UI
- `src/app/login/login.module.css` - Login page styling

## Next Steps

1. Set up authorized users in Firestore
2. Test phone authentication with a test number
3. Update dashboard page to check user authorization
4. Add session persistence and logout functionality
5. Update main page login link to point to `/login`
