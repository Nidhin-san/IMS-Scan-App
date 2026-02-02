---
description: How to update and maintain the standalone ScannerApp
---

# Updating Your Standalone App

Follow these steps to update your app after the initial deployment.

## 1. Local Testing
Always test your changes locally first using Expo Go.
```powershell
npx expo start --port 8082 --tunnel --clear
```

## 2. Push Small Updates (UI & Logic)
If you only changed `.tsx`, `.js`, or `.css` files, use **EAS Update**. This updates the app instantly without a new APK.
// turbo
```powershell
npx eas update --branch main --message "Added stock validation"
```

## 3. Push Major Updates (Native Changes)
If you added new packages or changed `app.json` (icons, names), you must rebuild the APK.
// turbo
```powershell
npx eas build -p android --profile preview
```

## 4. Environment Variables
If you change `.env` values, you must usually **rebuild** the app (Step 3) because these are baked into the standalone app at build time.
