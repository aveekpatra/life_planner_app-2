import { getGoogleCalendarCredentials } from "../utils/environment";

// Google Calendar API constants
const {
  apiKey: API_KEY,
  clientId: CLIENT_ID,
  redirectUri: REDIRECT_URI,
} = getGoogleCalendarCredentials();
const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

// Check if credentials are configured
if (!CLIENT_ID) {
  console.error(
    "Google Calendar CLIENT_ID is not configured in environment variables"
  );
}

if (!API_KEY) {
  console.warn("Google Calendar API_KEY is not set in environment variables");
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
  private tokenClient: google.accounts.oauth2.TokenClient | null = null;
  private isGapiLoaded = false;
  private isGisLoaded = false;
  private accessToken: string | null = null;
  private isAuthorized = false;
  private authPromiseResolve: ((value: void) => void) | null = null;
  private authPromiseReject: ((reason: any) => void) | null = null;
  private apiInitRetries = 0;
  private maxApiInitRetries = 3;

  constructor() {
    this.loadGapiAndGis();
    console.info(
      "GoogleCalendarService initialized with CLIENT_ID:",
      CLIENT_ID ? "Configured" : "Missing"
    );
    console.info(
      "GoogleCalendarService initialized with REDIRECT_URI:",
      REDIRECT_URI
    );

    // Try to restore auth state from localStorage immediately
    this.loadSavedAuthState();
  }

  /**
   * Loads the Google API client and OAuth2 library
   */
  private loadGapiAndGis(): void {
    console.log("Loading Google API libraries...");

    // Load the Google API client library
    const script1 = document.createElement("script");
    script1.src = "https://apis.google.com/js/api.js";
    script1.async = true;
    script1.defer = true;
    script1.onload = () => {
      console.log("Google API (gapi) script loaded");
      this.gapiLoaded();
    };
    script1.onerror = (e) => {
      console.error("Failed to load Google API script:", e);
    };
    document.head.appendChild(script1);

    // Load the Google Identity Services library
    const script2 = document.createElement("script");
    script2.src = "https://accounts.google.com/gsi/client";
    script2.async = true;
    script2.defer = true;
    script2.onload = () => {
      console.log("Google Identity Services (gis) script loaded");
      this.gisLoaded();
    };
    script2.onerror = (e) => {
      console.error("Failed to load Google Identity Services script:", e);
    };
    document.head.appendChild(script2);
  }

  /**
   * Callback after Google API client is loaded
   */
  private gapiLoaded(): void {
    console.log("Initializing Google API client...");
    gapi.load("client", () => {
      this.initializeGapiClient();
    });
  }

  /**
   * Initialize the Google API client - with retry capability
   */
  private initializeGapiClient(): void {
    console.log(
      `Attempting to initialize Google API client (attempt ${this.apiInitRetries + 1}/${this.maxApiInitRetries + 1})`
    );

    // Initialize without an API key or discovery docs since we'll use OAuth
    gapi.client
      .init({})
      .then(() => {
        // Manually load the Calendar API
        return gapi.client.load("calendar", "v3");
      })
      .then(() => {
        this.isGapiLoaded = true;
        this.apiInitRetries = 0;
        console.log("Google API client initialized successfully");
      })
      .catch((error) => {
        console.error("Error initializing Google API client:", error);

        // Log more detailed error information
        if (error && error.error) {
          console.error("Error details:", JSON.stringify(error.error));
        }

        // Retry logic
        if (this.apiInitRetries < this.maxApiInitRetries) {
          this.apiInitRetries++;
          console.log(
            `Retrying initialization in 2 seconds, attempt ${this.apiInitRetries}/${this.maxApiInitRetries}`
          );
          setTimeout(() => this.initializeGapiClient(), 2000);
        } else {
          console.error(
            `Failed to initialize Google API client after ${this.maxApiInitRetries + 1} attempts`
          );
          this.isGapiLoaded = false;
        }
      });
  }

  /**
   * Callback after Google Identity Services is loaded
   */
  private gisLoaded(): void {
    try {
      if (!CLIENT_ID) {
        throw new Error("Google Calendar CLIENT_ID is not configured");
      }

      console.log(
        "Initializing Google Identity Services with CLIENT_ID:",
        CLIENT_ID
      );

      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        callback: (response) => {
          console.log(
            "Auth callback received response:",
            response.error ? `Error: ${response.error}` : "Success"
          );

          if (response.error !== undefined) {
            console.error("Authorization error:", response.error);
            if (this.authPromiseReject) {
              this.authPromiseReject(
                new Error(`Authorization error: ${response.error}`)
              );
              this.authPromiseReject = null;
              this.authPromiseResolve = null;
            }
            return;
          }

          this.accessToken = response.access_token;
          this.isAuthorized = true;
          console.log("Successfully authorized with Google, token received");

          // Save refresh token if provided
          if (response.refresh_token) {
            console.log("Refresh token received, saving to localStorage");
            localStorage.setItem("gapi_refresh_token", response.refresh_token);
          }

          // Save auth state to localStorage immediately
          this.saveAuthState();

          // Resolve the promise from the authorize method if it exists
          if (this.authPromiseResolve) {
            this.authPromiseResolve();
            this.authPromiseResolve = null;
            this.authPromiseReject = null;
          }
        },
        error_callback: (error) => {
          console.error("Token client error:", error);
          if (this.authPromiseReject) {
            this.authPromiseReject(error);
            this.authPromiseReject = null;
            this.authPromiseResolve = null;
          }
        },
      });

      this.isGisLoaded = true;
      console.log("Google Identity Services initialized");
    } catch (error) {
      console.error("Failed to initialize Google Identity Services:", error);
      this.isGisLoaded = false;
    }
  }

  /**
   * Checks if both GAPI and GIS are loaded
   */
  public isLoaded(): boolean {
    const loaded = this.isGapiLoaded && this.isGisLoaded;
    if (!loaded) {
      console.log(
        `API loading status - GAPI: ${this.isGapiLoaded}, GIS: ${this.isGisLoaded}`
      );
    }
    return loaded;
  }

  /**
   * Save current auth state to localStorage
   */
  private saveAuthState(): void {
    try {
      if (this.isAuthorized && this.accessToken) {
        localStorage.setItem(
          LOCAL_STORAGE_AUTH_KEY,
          JSON.stringify({
            isAuthorized: this.isAuthorized,
            timestamp: Date.now(),
          })
        );

        // Store token separately
        localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, this.accessToken);
        console.log("Saved auth state to localStorage");
      }
    } catch (error) {
      console.error("Failed to save auth state:", error);
    }
  }

  /**
   * Load saved auth state from localStorage
   */
  private loadSavedAuthState(): void {
    try {
      const savedState = localStorage.getItem(LOCAL_STORAGE_AUTH_KEY);
      const savedToken = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);

      if (savedState && savedToken) {
        const state = JSON.parse(savedState);

        // Only restore if saved within the last 24 hours
        const isRecent = Date.now() - state.timestamp < 24 * 60 * 60 * 1000;

        if (isRecent) {
          this.isAuthorized = state.isAuthorized;
          this.accessToken = savedToken;
          console.log("Restored auth state from localStorage");
        } else {
          console.log("Saved auth state is too old, not restoring");
          this.clearSavedAuthState();
        }
      }
    } catch (error) {
      console.error("Failed to load saved auth state:", error);
      this.clearSavedAuthState();
    }
  }

  /**
   * Clear saved auth state from localStorage
   */
  private clearSavedAuthState(): void {
    try {
      localStorage.removeItem(LOCAL_STORAGE_AUTH_KEY);
      localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
      console.log("Cleared saved auth state");
    } catch (error) {
      console.error("Failed to clear saved auth state:", error);
    }
  }

  /**
   * Attempt to restore authorization state from existing token
   * This should be called after APIs are loaded to restore state on page refresh
   */
  public restoreAuthState(): void {
    if (!this.isLoaded()) {
      console.log("Cannot restore auth state - APIs not loaded yet");
      return;
    }

    // Try to set the token from localStorage if we have it
    if (this.accessToken && !gapi.client.getToken()) {
      console.log("Setting saved token to gapi client");
      try {
        gapi.client.setToken({ access_token: this.accessToken });
      } catch (error) {
        console.error("Failed to set token:", error);
      }
    }

    const token = gapi.client.getToken();
    if (token !== null) {
      console.log("Found existing token, restoring auth state");
      this.isAuthorized = true;
      this.accessToken = token.access_token;

      // Save this back to localStorage
      this.saveAuthState();
      return;
    }

    console.log("No existing token found");
  }

  /**
   * Handles the authorization process with Google
   */
  public authorize(): Promise<void> {
    console.log("authorize() called, checking if APIs are loaded");

    return new Promise((resolve, reject) => {
      if (!this.isLoaded()) {
        const error = new Error("Google APIs not loaded yet");
        console.error(error);
        reject(error);
        return;
      }

      if (this.isAuthorized) {
        console.log("Already authorized, resolving immediately");
        resolve();
        return;
      }

      // Store the promise callbacks to be called by the token client callback
      this.authPromiseResolve = resolve;
      this.authPromiseReject = reject;

      console.log("Requesting access token...");
      if (gapi.client.getToken() === null) {
        // Request an access token
        console.log("No existing token, requesting with consent prompt");
        this.tokenClient!.requestAccessToken({
          prompt: "consent",
        });
      } else {
        // Skip consent if already authorized
        console.log("Existing token found, requesting without prompt");
        this.tokenClient!.requestAccessToken({
          prompt: "",
        });
      }
    });
  }

  /**
   * List all events from a calendar within a date range
   */
  async listEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string,
    maxResults: number = 50
  ): Promise<{ items: GoogleCalendarEvent[] }> {
    try {
      await this.ensureInitialized();

      console.log(
        `Fetching events for ${calendarId} from ${timeMin} to ${timeMax} (max: ${maxResults})`
      );

      // Improved response handling with better logging
      return await gapi.client.calendar.events
        .list({
          calendarId,
          timeMin,
          timeMax,
          maxResults,
          singleEvents: true,
          orderBy: "startTime",
        })
        .then((response) => {
          // Log detailed response info for debugging
          console.log(`Calendar API response status: ${response.status}`);
          console.log(`Calendar API response has result: ${!!response.result}`);

          if (!response.result) {
            console.warn("Calendar API returned empty result");
            return { items: [] };
          }

          if (!response.result.items) {
            console.warn("Calendar API result missing items array");
            console.log("Full response:", JSON.stringify(response.result));
            // Return empty items array as fallback
            return { items: [] };
          }

          console.log(
            `Calendar API returned ${response.result.items.length} events`
          );
          return response.result;
        });
    } catch (error) {
      console.error("Error fetching events:", error);
      // Return empty items array on error
      return { items: [] };
    }
  }

  /**
   * Create a new event on the calendar
   */
  async createEvent(
    calendarId: string,
    event: GoogleCalendarEventInput
  ): Promise<GoogleCalendarEvent> {
    try {
      await this.ensureInitialized();

      // Fixed this return so it properly returns the Promise result
      return await gapi.client.calendar.events
        .insert({
          calendarId,
          resource: event,
        })
        .then((response) => {
          return response.result;
        });
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  }

  /**
   * Update an existing event on the calendar
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<GoogleCalendarEventInput>
  ): Promise<GoogleCalendarEvent> {
    try {
      await this.ensureInitialized();

      // Fixed this return so it properly returns the Promise result
      return await gapi.client.calendar.events
        .patch({
          calendarId,
          eventId,
          resource: event,
        })
        .then((response) => {
          return response.result;
        });
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  }

  /**
   * Delete an event from the calendar
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.ensureInitialized();

      // Fixed this return so it properly returns the Promise result
      return await gapi.client.calendar.events
        .delete({
          calendarId,
          eventId,
        })
        .then(() => {
          // Return void explicitly
          return;
        });
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  }

  /**
   * Fetches the list of calendars from the Google Calendar API
   */
  public async listCalendars(): Promise<GoogleCalendarList> {
    if (!this.isAuthorized) {
      console.log("Not authorized, authorizing before listing calendars");
      await this.authorize();
    }

    try {
      console.log("Fetching calendar list");
      const response = await gapi.client.calendar.calendarList.list();
      console.log(`Retrieved ${response.result.items.length} calendars`);
      return response.result as GoogleCalendarList;
    } catch (error) {
      console.error("Error fetching calendars:", error);
      throw error;
    }
  }

  /**
   * Signs the user out of Google Calendar
   */
  public signOut(): void {
    console.log("Signing out of Google Calendar");
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken(null);
        this.isAuthorized = false;
        this.accessToken = null;

        // Clear saved auth state
        this.clearSavedAuthState();

        console.log("Signed out of Google");
      });
    } else {
      console.log("No token to revoke");

      // Clear saved auth state anyway
      this.clearSavedAuthState();
    }
  }

  /**
   * Gets the authorization status
   */
  public getIsAuthorized(): boolean {
    return this.isAuthorized;
  }

  /**
   * Get the current token information
   * @returns TokenInfo object or null if not authorized
   */
  getTokenInfo() {
    if (!this.tokenClient || !this.isAuthorized) {
      return null;
    }

    try {
      // Get the current access token from Google auth instance
      const authInstance = gapi.auth2?.getAuthInstance();
      if (!authInstance) return null;

      const currentUser = authInstance.currentUser.get();
      if (!currentUser) return null;

      const authResponse = currentUser.getAuthResponse(true);
      if (!authResponse) return null;

      return {
        accessToken: authResponse.access_token,
        expiryTime: new Date(authResponse.expires_at).toISOString(),
        refreshToken: localStorage.getItem("gapi_refresh_token") || "", // Refresh token may be stored in localStorage
      };
    } catch (error) {
      console.error("Error getting token info:", error);
      return null;
    }
  }

  /**
   * Attempt to refresh an expired token
   * @returns A promise that resolves when token is refreshed or rejects if refresh fails
   */
  public refreshToken(): Promise<void> {
    console.log("Attempting to refresh the access token");

    return new Promise((resolve, reject) => {
      if (!this.isLoaded()) {
        reject(new Error("Google APIs not loaded yet"));
        return;
      }

      // Check if we have a refresh token in localStorage
      const refreshToken = localStorage.getItem("gapi_refresh_token");
      if (refreshToken) {
        console.log(
          "Found refresh token in localStorage, using it for silent refresh"
        );
      } else {
        console.log("No refresh token found in localStorage");
      }

      this.authPromiseResolve = resolve;
      this.authPromiseReject = reject;

      try {
        // Request a new token with silent prompt
        this.tokenClient!.requestAccessToken({
          prompt: "", // Skip UI if possible
        });
      } catch (error) {
        console.error("Error refreshing token:", error);
        this.authPromiseReject = null;
        this.authPromiseResolve = null;
        reject(error);
      }
    });
  }

  /**
   * Ensures Google API is initialized and user is authorized
   * Refreshes token if needed
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isLoaded()) {
      throw new Error("Google APIs not loaded yet");
    }

    if (!this.isAuthorized) {
      console.log("Not authorized, authorizing first");
      await this.authorize();
    }
  }
}

// Create a singleton instance for the whole app to use
export const googleCalendarService = new GoogleCalendarService();
