# billing-website
Billing website for SSM Cabs.

## Firebase Setup (Firestore)

Create a Firebase project and add these environment variables in a
`.env.local` file:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Run the app locally:

```bash
npm install
npm run dev
```
