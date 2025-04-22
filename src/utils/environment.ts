/**
 * Environment utility functions for safely accessing environment variables
 */

/**
 * Get a required environment variable, throwing an error if it's not defined
 * @param name The name of the environment variable
 * @returns The value of the environment variable
 */
export function getRequiredEnv(name: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv];
  if (!value) {
    throw new Error(`Environment variable ${name} is not defined`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default value
 * @param name The name of the environment variable
 * @param defaultValue The default value to use if the environment variable is not defined
 * @returns The value of the environment variable or the default value
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv];
  return value || defaultValue;
}

/**
 * Verify that all required environment variables are defined
 * @param names List of required environment variable names
 * @returns True if all required environment variables are defined
 */
export function verifyRequiredEnv(names: string[]): boolean {
  try {
    names.forEach(getRequiredEnv);
    return true;
  } catch (error) {
    // console.error(error);
    return false;
  }
}

/**
 * Get Google Calendar credentials from environment variables
 */
export function getGoogleCalendarCredentials() {
  // Get the current origin for the redirect URI
  let redirectUri = getOptionalEnv("VITE_GOOGLE_REDIRECT_URI", "");

  // If no redirect URI is provided, use the current origin with a specific path
  if (!redirectUri && typeof window !== "undefined") {
    // Always ensure the redirect URI points to the correct callback route
    redirectUri = `${window.location.origin}/auth/google/callback`;
    console.log("Generated redirectUri:", redirectUri);
  }

  return {
    apiKey: getOptionalEnv("VITE_GOOGLE_API_KEY", ""),
    clientId: getRequiredEnv("VITE_GOOGLE_CLIENT_ID"),
    clientSecret: getOptionalEnv("VITE_GOOGLE_CLIENT_SECRET", ""),
    redirectUri,
    projectId: getOptionalEnv("VITE_GOOGLE_PROJECT_ID", ""),
  };
}
