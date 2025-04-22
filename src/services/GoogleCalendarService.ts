import { getGoogleCalendarCredentials } from "../utils/environment";
import { format, parseISO } from "date-fns";

// Google Calendar API constants
const {
  apiKey: API_KEY,
  clientId: CLIENT_ID,
  redirectUri: REDIRECT_URI,
} = getGoogleCalendarCredentials();
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

// Check if credentials are configured
if (!CLIENT_ID) {
  // console.error(
  //   "Google Calendar CLIENT_ID is not configured in environment variables"
  // );
}

if (!API_KEY) {
  // console.warn("Google Calendar API_KEY is not set in environment variables");
}

// Add constants for localStorage keys
const LOCAL_STORAGE_AUTH_KEY = "google_calendar_auth_state";
const LOCAL_STORAGE_TOKEN_KEY = "google_calendar_token";

// Types for Google Calendar events
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
  creator?: {
    email: string;
    displayName?: string;
  };
  organizer?: {
    email: string;
    displayName?: string;
  };
  attendees?: {
    email: string;
    displayName?: string;
    responseStatus?: string;
  }[];
  recurringEventId?: string;
  originalStartTime?: {
    dateTime: string;
    date?: string;
  };
}

export interface GoogleCalendarList {
  kind: string;
  etag: string;
  nextSyncToken: string;
  items: {
    id: string;
    summary: string;
    description?: string;
    primary?: boolean;
    colorId?: string;
    backgroundColor?: string;
    foregroundColor?: string;
    selected?: boolean;
  }[];
}

export class GoogleCalendarService {
  private accessToken: string | null = null;
  private isAuthorized = false;
  private authPromiseResolve: ((value: void) => void) | null = null;
  private authPromiseReject: ((reason: any) => void) | null = null;

  constructor() {
    console.log("GoogleCalendarService initialized");
    console.log("REDIRECT_URI:", REDIRECT_URI);

    // Validate the redirect URI
    if (!REDIRECT_URI || !REDIRECT_URI.includes("/auth/google/callback")) {
      console.error(
        "Invalid REDIRECT_URI configuration. Expected a URL containing '/auth/google/callback'."
      );
    }

    // Try to restore auth state from localStorage immediately
    this.loadSavedAuthState();

    // Set up the direct auth event listener
    this.setupDirectAuthListener();
  }

  /**
   * Check if the service is loaded and ready
   */
  public isLoaded(): boolean {
    return true; // Always return true since we're using fetch API now
  }

  /**
   * Save the current auth state to localStorage
   */
  private saveAuthState(): void {
    if (this.accessToken) {
      try {
        console.log("Saving auth state to localStorage");
        // Save the auth state
        localStorage.setItem(
          LOCAL_STORAGE_AUTH_KEY,
          JSON.stringify({
            isAuthorized: this.isAuthorized,
            timestamp: new Date().getTime(),
          })
        );

        // Save the token separately
        localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, this.accessToken);

        console.log("Auth state saved successfully");
      } catch (e) {
        console.error("Failed to save auth state to localStorage:", e);
      }
    }
  }

  /**
   * Load auth state from localStorage
   */
  private loadSavedAuthState(): void {
    try {
      const authState = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
      const savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);

      if (authState && savedToken) {
        const parsedState = JSON.parse(authState);

        if (parsedState.isAuthorized) {
          // console.log("Restoring auth state from localStorage");
          this.isAuthorized = true;
          this.accessToken = savedToken;

          // Verify the token by making a test request to confirm it's still valid
          this.verifyToken().catch(() => {
            // If verification fails, clear the saved state
            console.log(
              "Saved token is invalid or expired, clearing auth state"
            );
            this.clearSavedAuthState();
            this.isAuthorized = false;
            this.accessToken = null;
          });

          return;
        }
      }

      // console.log("No valid saved auth state found in localStorage");
    } catch (e) {
      console.error("Error loading saved auth state:", e);
      // Clear potentially corrupted state
      this.clearSavedAuthState();
    }
  }

  /**
   * Verify if the current token is valid by making a test request
   */
  private async verifyToken(): Promise<boolean> {
    if (!this.accessToken) {
      console.log("No access token present to verify");
      return false;
    }

    console.log("Verifying token validity...");

    try {
      // Make a lightweight API call to verify the token
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const isValid = response.ok;
      console.log("Token verification result:", isValid ? "valid" : "invalid");
      return isValid;
    } catch (error) {
      console.error("Token verification error:", error);
      return false;
    }
  }

  /**
   * Clear saved auth state from localStorage
   */
  private clearSavedAuthState(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
      localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
      localStorage.removeItem("gapi_refresh_token");
      // console.log("Cleared saved auth state from localStorage");
    } catch (e) {
      // console.error("Error clearing saved auth state:", e);
    }
  }

  /**
   * Attempt to restore authorization state
   */
  public restoreAuthState(): void {
    this.loadSavedAuthState();
  }

  /**
   * Create OAuth URL
   */
  private createAuthUrl(): string {
    const authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";

    // Ensure we have the correct redirect URI
    const finalRedirectUri =
      REDIRECT_URI ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/auth/google/callback`
        : "");

    console.log("Using redirect URI for auth:", finalRedirectUri);

    // For a web application, using authorization code flow is better than implicit flow
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: finalRedirectUri,
      response_type: "code", // Using authorization code flow
      scope: SCOPES.join(" "),
      prompt: "consent",
      access_type: "online",
    });

    return `${authEndpoint}?${params.toString()}`;
  }

  /**
   * Handle authorization code exchange
   */
  private async exchangeCodeForToken(code: string): Promise<string> {
    const tokenEndpoint = "https://oauth2.googleapis.com/token";

    console.log("Exchanging authorization code for token");

    // Ensure we have the correct redirect URI for token exchange
    const finalRedirectUri =
      REDIRECT_URI ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/auth/google/callback`
        : "");

    console.log("Using redirect URI for token exchange:", finalRedirectUri);

    // Include the client secret - this is critical for the server-side flow
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: getGoogleCalendarCredentials().clientSecret,
      redirect_uri: finalRedirectUri,
      code: code,
      grant_type: "authorization_code",
    });

    try {
      console.log("Token request parameters prepared");
      console.log("Sending token request to Google");

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      const responseText = await response.text();
      console.log(`Token response status: ${response.status}`);

      if (!response.ok) {
        console.error(
          `Token exchange failed: ${response.status}`,
          responseText
        );
        throw new Error(
          `Token exchange failed: ${response.status} - ${responseText}`
        );
      }

      try {
        const data = JSON.parse(responseText);
        console.log("Successfully obtained access token");
        return data.access_token;
      } catch (parseError) {
        console.error("Error parsing token response:", parseError);
        throw new Error("Invalid token response format");
      }
    } catch (error) {
      console.error("Error exchanging code for token:", error);
      throw error;
    }
  }

  /**
   * Authorize with Google Calendar
   */
  public authorize(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isAuthorized && this.accessToken) {
        // console.log("Already authorized with Google Calendar");
        resolve();
        return;
      }

      this.authPromiseResolve = resolve;
      this.authPromiseReject = reject;

      // Generate OAuth URL using authorization code flow
      const authUrl = this.createAuthUrl();
      // console.log(`Opening auth URL: ${authUrl}`);

      // Set up message event listener to receive the code from callback window
      const messageHandler = (event: MessageEvent) => {
        // Verify the origin matches our app's origin for security
        if (event.origin !== window.location.origin) {
          console.log("Ignoring message from unknown origin:", event.origin);
          return;
        }

        // Check if this is our auth callback message
        if (event.data?.type === "GOOGLE_AUTH_CALLBACK") {
          console.log("Received auth callback message:", event.data);

          // Remove event listener once we've received the message
          window.removeEventListener("message", messageHandler);

          const { code, error } = event.data;

          if (error) {
            console.error("Auth error from callback:", error);
            this.authPromiseReject?.(new Error(`Auth error: ${error}`));
            this.authPromiseReject = null;
            this.authPromiseResolve = null;
            return;
          }

          if (code) {
            // Exchange code for token
            this.exchangeCodeForToken(code)
              .then((accessToken) => {
                // Store the token
                this.accessToken = accessToken;
                this.isAuthorized = true;

                // Save auth state
                this.saveAuthState();

                console.log(
                  "Successfully authenticated with Google Calendar via postMessage"
                );
                this.authPromiseResolve?.();
                this.authPromiseResolve = null;
                this.authPromiseReject = null;
              })
              .catch((error) => {
                console.error("Failed to exchange code for token:", error);
                this.authPromiseReject?.(error);
                this.authPromiseReject = null;
                this.authPromiseResolve = null;
              });
          } else {
            this.authPromiseReject?.(
              new Error("No authorization code received in message")
            );
            this.authPromiseReject = null;
            this.authPromiseResolve = null;
          }
        }
      };

      // Add the message event listener
      window.addEventListener("message", messageHandler);

      // Open the authorization popup with larger dimensions
      const popup = window.open(
        authUrl,
        "googleAuthPopup",
        "width=800,height=700,resizable=yes,scrollbars=yes,status=yes"
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        // Popup was blocked or failed to open
        window.removeEventListener("message", messageHandler);
        this.authPromiseReject?.(
          new Error(
            "Google authorization popup was blocked. Please allow popups for this site."
          )
        );
        this.authPromiseReject = null;
        this.authPromiseResolve = null;
        return;
      }

      // Poll the popup for the authorization code as a fallback mechanism
      const pollTimer = window.setInterval(() => {
        try {
          if (popup && popup.closed) {
            window.clearInterval(pollTimer);
            window.removeEventListener("message", messageHandler);
            // Only reject if there's still a pending promise
            if (this.authPromiseReject) {
              // console.log("Auth popup closed by user before completion");
              this.authPromiseReject(new Error("Authorization popup closed"));
              this.authPromiseReject = null;
              this.authPromiseResolve = null;
            }
          } else if (popup && popup.location.href.includes(REDIRECT_URI)) {
            window.clearInterval(pollTimer);
            window.removeEventListener("message", messageHandler);

            // Get the authorization code from URL query params
            const url = new URL(popup.location.href);
            const code = url.searchParams.get("code");
            const error = url.searchParams.get("error");

            if (error) {
              popup.close();
              this.authPromiseReject?.(
                new Error(`Authorization error: ${error}`)
              );
              this.authPromiseReject = null;
              this.authPromiseResolve = null;
              return;
            }

            if (code) {
              popup.close();

              // Exchange code for token
              this.exchangeCodeForToken(code)
                .then((accessToken) => {
                  // Store the token
                  this.accessToken = accessToken;
                  this.isAuthorized = true;

                  // Save auth state
                  this.saveAuthState();

                  // console.log("Successfully authenticated with Google Calendar");
                  this.authPromiseResolve?.();
                  this.authPromiseResolve = null;
                  this.authPromiseReject = null;
                })
                .catch((error) => {
                  // console.error("Failed to exchange code for token:", error);
                  this.authPromiseReject?.(error);
                  this.authPromiseReject = null;
                  this.authPromiseResolve = null;
                });
            } else {
              popup.close();
              this.authPromiseReject?.(
                new Error("No authorization code received")
              );
              this.authPromiseReject = null;
              this.authPromiseResolve = null;
            }
          }
        } catch (e) {
          // Catch cross-origin errors when polling
          // This is expected and not an error
          // console.log("Cross-origin polling error (expected):", e);
        }
      }, 500);

      // Add a timeout to prevent the popup from being open indefinitely
      setTimeout(() => {
        if (popup && !popup.closed) {
          // console.log("Auth timeout reached, closing popup");
          window.clearInterval(pollTimer);
          window.removeEventListener("message", messageHandler);
          popup.close();
          this.authPromiseReject?.(
            new Error("Authorization timed out after 2 minutes")
          );
          this.authPromiseReject = null;
          this.authPromiseResolve = null;
        }
      }, 120000); // 2 minute timeout
    });
  }

  /**
   * Set up listener for direct authentication events
   * This handles cases where the user completes authentication in a new tab
   * (when popup is blocked) and returns to the main app
   */
  private setupDirectAuthListener(): void {
    window.addEventListener("GOOGLE_AUTH_DIRECT", (event: Event) => {
      const customEvent = event as CustomEvent;
      const { code } = customEvent.detail;

      console.log("Received direct auth event with code");

      if (code) {
        // Exchange code for token
        this.exchangeCodeForToken(code)
          .then((accessToken) => {
            // Store the token
            this.accessToken = accessToken;
            this.isAuthorized = true;

            // Save auth state
            this.saveAuthState();

            console.log(
              "Successfully authenticated with Google Calendar via direct auth"
            );

            // Trigger any pending auth promise
            if (this.authPromiseResolve) {
              this.authPromiseResolve();
              this.authPromiseResolve = null;
              this.authPromiseReject = null;
            }
          })
          .catch((error) => {
            console.error(
              "Failed to exchange code for token in direct auth:",
              error
            );
            if (this.authPromiseReject) {
              this.authPromiseReject(error);
              this.authPromiseReject = null;
              this.authPromiseResolve = null;
            }
          });
      }
    });
  }

  /**
   * Make an authenticated request to Google Calendar API
   */
  private async makeRequest(
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<any> {
    if (!this.isAuthorized || !this.accessToken) {
      throw new Error("Not authorized");
    }

    const url = new URL(`https://www.googleapis.com/calendar/v3/${endpoint}`);

    // Add API key and other params to URL
    if (API_KEY) {
      url.searchParams.append("key", API_KEY);
    }

    // Add all other params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });

    // console.log(`Making request to: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        // console.error(`API error (${response.status}): ${errorText}`);

        // Handle 401 unauthorized errors (token expired)
        if (response.status === 401) {
          // console.log("Token expired, clearing auth state");
          this.clearSavedAuthState();
          this.isAuthorized = false;
          this.accessToken = null;
          throw new Error("Token expired");
        }

        throw new Error(
          `API request failed: ${response.statusText} - ${errorText}`
        );
      }

      return await response.json();
    } catch (error) {
      // console.error("API request error:", error);
      throw error;
    }
  }

  /**
   * List events from Google Calendar
   */
  async listEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults: number = 50
  ): Promise<{ items: GoogleCalendarEvent[] }> {
    if (!this.isAuthorized) {
      // console.error("Not authorized");
      return { items: [] };
    }

    try {
      // console.log(
      //   `Fetching events for ${calendarId} from ${timeMin} to ${timeMax} (max: ${maxResults})`
      // );

      const params: Record<string, string> = {
        timeMin: timeMin,
        timeMax: timeMax,
        maxResults: String(maxResults),
        singleEvents: "true",
        orderBy: "startTime",
      };

      const response = await this.makeRequest(
        `calendars/${encodeURIComponent(calendarId)}/events`,
        params
      );

      const events = response.items || [];
      // console.log(`Retrieved ${events.length} events from Google Calendar`);

      // Try to get calendar information
      try {
        const calendarInfo = await this.makeRequest(
          `calendarList/${encodeURIComponent(calendarId)}`
        );

        const extendedEvents = events.map((event: any) => ({
          ...event,
          calendarTitle: calendarInfo.summary,
          calendarColor: calendarInfo.backgroundColor,
        }));

        return { items: extendedEvents as GoogleCalendarEvent[] };
      } catch (calendarError) {
        // console.warn("Error getting calendar details:", calendarError);
        return { items: events as GoogleCalendarEvent[] };
      }
    } catch (error) {
      // console.error("Error fetching Google Calendar events:", error);
      return { items: [] };
    }
  }

  /**
   * List available calendars
   */
  public async listCalendars(): Promise<GoogleCalendarList> {
    if (!this.isAuthorized) {
      // console.error("Not authorized");
      return { kind: "", etag: "", nextSyncToken: "", items: [] };
    }

    try {
      const response = await this.makeRequest("users/me/calendarList");
      // console.log(`Found ${response.items?.length || 0} calendars`);
      return response as GoogleCalendarList;
    } catch (error) {
      // console.error("Error fetching Google Calendars:", error);
      return { kind: "", etag: "", nextSyncToken: "", items: [] };
    }
  }

  /**
   * Sign out from Google Calendar
   */
  public signOut(): void {
    // console.log("Signing out from Google Calendar");
    this.accessToken = null;
    this.isAuthorized = false;
    this.clearSavedAuthState();
  }

  /**
   * Check if user is authorized
   */
  public getIsAuthorized(): boolean {
    return this.isAuthorized;
  }

  /**
   * Get the current access token
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }
}

// Create a singleton instance for the whole app to use
export const googleCalendarService = new GoogleCalendarService();
