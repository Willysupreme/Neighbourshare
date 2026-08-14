# NeighborShare — Local Test & Vercel CLI Deploy Guide

## Part A — Test locally first

1. Copy `.env.example` to `.env.local` in the `app/` folder and fill in:

   - The six `NEXT_PUBLIC_FIREBASE_*` values (already known — see below)
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=kgr9v5bm`
   - `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=meqco8pm`
   - The three `FIREBASE_ADMIN_*` values — get these from:
     Firebase console → Project settings (gear icon) → Service accounts →
     "Generate new private key". This downloads a JSON file. From it:
       FIREBASE_ADMIN_PROJECT_ID       = project_id
       FIREBASE_ADMIN_CLIENT_EMAIL     = client_email
       FIREBASE_ADMIN_PRIVATE_KEY      = private_key (keep the \n sequences as-is, wrap in quotes)
     Keep this JSON file OFF GitHub. Do not paste its contents into chat.

Your known Firebase web config:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCZEuE5V8jwgusssqSdqWqOev36sFsj7QE
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=neighbourshare-10d73.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=neighbourshare-10d73
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=neighbourshare-10d73.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=801351312869
NEXT_PUBLIC_FIREBASE_APP_ID=1:801351312869:web:a70dae02760943732f3b0c
```

2. Before running the app, make sure you've done in the Firebase console:
   - Authentication → Sign-in method → enable **Email/Password**
   - Firestore Database → **Create database** → production mode

3. Deploy the security rules + indexes (one-time, from the `app/` folder):
   ```
   npm install -g firebase-tools    # if you don't have it
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   (`.firebaserc` already points this at neighbourshare-10d73, so no
   `firebase use` step is needed.)

4. Run it:
   ```
   npm install
   npm run dev
   ```
   Open http://localhost:3000 — register an account, verify with a
   neighborhood code (e.g. `MAPLE2026` for Maplewood), list an item with a
   photo, and try requesting/approving a booking to confirm everything is
   wired correctly end-to-end.

5. To make yourself an admin (for testing the admin dashboard): after
   registering, open Firestore in the Firebase console, find your user
   document under `users/{your-uid}`, and manually change `role` from
   `"user"` to `"admin"`.

## Part B — Deploy via Vercel CLI (before connecting GitHub)

No credit card needed — Hobby plan is free for personal/non-commercial
projects, and this app is well within the free limits.

1. From the `app/` folder:
   ```
   npm install -g vercel
   vercel login
   ```
   This opens your browser for a one-time login (email or GitHub OAuth —
   logging in with GitHub here does NOT connect this Vercel deployment to
   the repo; that's a separate step later).

2. Link and deploy a preview:
   ```
   vercel
   ```
   Answer the prompts: "Set up and deploy?" → Yes. Link to existing project?
   → No (create new). Project name → neighborshare (or your choice).
   This gives you a preview URL (`*.vercel.app`) without going live yet.

3. Add environment variables (repeat for each — Vercel will prompt you to
   paste the value, and asks which environments: choose all three
   Production/Preview/Development for simplicity):
   ```
   vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
   vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
   vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
   vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
   vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
   vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
   vercel env add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
   vercel env add NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
   vercel env add FIREBASE_ADMIN_PROJECT_ID
   vercel env add FIREBASE_ADMIN_CLIENT_EMAIL
   vercel env add FIREBASE_ADMIN_PRIVATE_KEY
   ```
   For FIREBASE_ADMIN_PRIVATE_KEY, paste the whole key including the
   `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines and
   the literal `\n` sequences, wrapped as one line.

4. Deploy to production:
   ```
   vercel --prod
   ```
   This gives you your live URL — record it for Deployment_and_Source_Links.txt.

5. Add your Firebase project's authorized domain: in the Firebase console →
   Authentication → Settings → Authorized domains → add your new
   `*.vercel.app` domain (otherwise login/signup will be blocked on the live
   site with an `auth/unauthorized-domain` error).

## Part C — Push to GitHub yourself, then connect it in Vercel

Once you're happy locally and on the CLI-deployed preview:

```
cd app
git remote add origin https://github.com/Willysupreme/Neighbourshare.git
git branch -M main
git push -u origin main
```

Then in the Vercel dashboard: your project → Settings → Git → Connect Git
Repository → select Willysupreme/Neighbourshare. From then on, every push
to `main` auto-deploys — no more `vercel --prod` needed.
