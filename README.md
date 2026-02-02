# IMS Scan

**IMS Scan** is a professional mobile inventory management application built with Expo and React Native. It features a high-performance barcode scanner, a real-time stock validation system, and a multi-item cart flow.

## Key Features

-   **Secure Authentication**: Fully integrated login system using `AuthContext` and Supabase.
-   **Precision Barcode Scanner**: 
    -   Restricted scan area (blue guide box) for accurate targeting.
    -   Animated scanning line for visual feedback.
    -   Ignores barcodes outside the designated focus area.
-   **Real-time Stock Validation**: 
    -   Instantly fetches current stock levels from the database upon scanning.
    -   Visually flags low stock (under 10 units) in red.
    -   Prevents adding items to the cart if requested quantity exceeds available stock.
-   **Multi-Item Cart System**: 
    -   Scan multiple items and add them to a local cart.
    -   Floating cart badge and checkout modal.
    -   Consolidate multiple items into a single order record in Supabase.
-   **Standalone Android APK**: Optimized for native deployment without requiring Expo Go.

## 🛠 Tech Stack

-   **Frontend**: React Native, Expo (SDK 54), Expo Router.
-   **Database/Backend**: Supabase (PostgreSQL), FastAPI (Python).
-   **Scanning**: `expo-camera`.
-   **Storage**: `expo-secure-store` for session management.

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root with your Supabase and API credentials:
```text
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
EXPO_PUBLIC_API_URL=your_api_url
```

### 3. Start Local Development
```bash
npx expo start --port 8082 --tunnel --clear
```

## Deployment (EAS Build)

The app is branded as **IMS Scan** with a custom professional logo.

### Push UI/Logic Updates (OTA)
If you only change `.tsx` files:
```bash
npx eas update --branch main --message "Update description"
```

### New Standalone APK
If you change app settings or native modules:
```bash
npx eas build -p android --profile preview
```

---
*Created for Inventory Management Systems.*
