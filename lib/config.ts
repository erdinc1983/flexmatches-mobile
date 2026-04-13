// API keys — loaded from environment variables, never hardcoded
// Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in .env (local) and EAS secrets (CI/CD)
export const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";
