import { useState, useEffect, useCallback } from "react";
import {
  googleCalendarService,
  GoogleCalendarEvent,
  GoogleCalendarList,
} from "../services/GoogleCalendarService";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

interface UseGoogleCalendarReturn {
  isLoading: boolean;
  error: Error | null;
  events: GoogleCalendarEvent[];
  calendars: GoogleCalendarList | null;
  isAuthorized: boolean;
  connectToGoogleCalendar: () => Promise<void>;
  disconnectFromGoogleCalendar: () => void;
  refreshEvents: (
    calendarId?: string,
    timeMin?: string,
    timeMax?: string,
    maxResults?: number,
    forceRefresh?: boolean
  ) => Promise<void>;
}

// Cache management for Google Calendar events
const CACHE_KEY_PREFIX = "google_calendar_events_";
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Get a cache key for a specific time range
const getCacheKey = (calendarId: string, timeMin: string, timeMax: string) => {
  return `${CACHE_KEY_PREFIX}${calendarId}_${timeMin}_${timeMax}`;
};

// Save events to cache
const saveToCache = (
  key: string,
  events: GoogleCalendarEvent[] | undefined
) => {
  try {
    // Guard against undefined events
    if (!events) {
      console.warn(`Cannot save undefined events to cache for key: ${key}`);
      return;
    }

    const cacheItem = {
      events,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
    console.log(`Saved ${events.length} events to cache with key: ${key}`);
  } catch (err) {
    console.error("Failed to save events to cache:", err);
  }
};

// Get events from cache
const getFromCache = (key: string): GoogleCalendarEvent[] | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { events, timestamp } = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - timestamp > CACHE_EXPIRY_MS) {
      console.log("Cache expired, removing:", key);
      localStorage.removeItem(key);
      return null;
    }

    console.log(
      `Retrieved ${events.length} events from cache with key: ${key}`
    );
    return events;
  } catch (err) {
    console.error("Failed to retrieve events from cache:", err);
    return null;
  }
};

export function useGoogleCalendar(): UseGoogleCalendarReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendarList | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiLoadChecks, setApiLoadChecks] = useState(0);
  const maxApiLoadChecks = 60; // 30 seconds max wait time (500ms interval)

  // Convex mutations and queries
  const saveAuthData = useMutation(api.googleCalendarAuth.saveAuthData);
  const revokeAuth = useMutation(api.googleCalendarAuth.revokeAuth);
  const authStatus = useQuery(api.googleCalendarAuth.getAuthStatus);

  // Connect to Google Calendar - Define this function early
  const connectToGoogleCalendar = useCallback(async () => {
    if (!apiLoaded) {
      if (apiLoadChecks >= maxApiLoadChecks) {
        const errorMsg =
          "Google API failed to load. Please refresh the page and try again.";
        console.error(errorMsg);
        setError(new Error(errorMsg));
      } else {
        console.error("Cannot connect to Google Calendar - API not loaded yet");
        setError(
          new Error(
            "Google API not loaded yet. Please wait a moment and try again."
          )
        );
      }
      return;
    }

    console.log("Attempting to connect to Google Calendar...");
    setIsLoading(true);
    setError(null);

    try {
      // Check if we have a refresh token stored in Convex but not in localStorage
      if (authStatus?.refreshToken) {
        console.log("Found existing refresh token in Convex database");

        // Set it in localStorage for the Google service to use
        if (authStatus.refreshToken.length > 0) {
          console.log(
            "Setting refresh token from Convex to localStorage for immediate reconnection"
          );
          localStorage.setItem("gapi_refresh_token", authStatus.refreshToken);

          // Try to force a token refresh immediately using silent mode
          try {
            await googleCalendarService.refreshToken();
            console.log(
              "Silent refresh token succeeded using Convex refresh token"
            );

            // If refresh succeeded, update the auth state right away
            const tokenInfo = googleCalendarService.getTokenInfo();
            if (tokenInfo) {
              await saveAuthData({
                isAuthorized: true,
                accessToken: tokenInfo.accessToken,
                tokenExpiry: tokenInfo.expiryTime,
                refreshToken: tokenInfo.refreshToken || authStatus.refreshToken, // Keep original if no new one
              });
              setIsAuthorized(true);
              console.log("Updated auth data in Convex after silent refresh");
              setIsLoading(false);

              // Load events immediately after successful authentication
              try {
                const now = new Date();
                const startDate = new Date(
                  now.getFullYear(),
                  now.getMonth(),
                  1
                );
                const endDate = new Date(
                  now.getFullYear(),
                  now.getMonth() + 1,
                  0
                );

                console.log(
                  "Loading initial events after successful authentication"
                );

                // We need to use a local function here to avoid circular dependency issues
                // This will be replaced with the proper fetchAllCalendarEvents call once it's defined
                const loadInitialEvents = async () => {
                  try {
                    // First fetch calendar list
                    const calendarList =
                      await googleCalendarService.listCalendars();
                    setCalendars(calendarList);

                    // Then fetch events from the primary calendar as a fallback
                    const response = await googleCalendarService.listEvents(
                      "primary",
                      startDate.toISOString(),
                      endDate.toISOString(),
                      250
                    );

                    if (response && response.items) {
                      setEvents(response.items);
                      console.log(
                        `Loaded ${response.items.length} initial events`
                      );
                    }
                  } catch (error) {
                    console.error("Error loading initial events:", error);
                  }
                };

                // Start loading events in the background
                loadInitialEvents();
              } catch (err) {
                console.error("Failed to load initial events:", err);
              }
              return;
            }
          } catch (refreshErr) {
            console.warn(
              "Silent refresh failed, will try standard authorization flow",
              refreshErr
            );
            // Continue with normal flow if silent refresh fails
          }
        }
      }

      // First try to refresh the token if we have one
      const existingToken =
        authStatus?.isAuthorized &&
        authStatus?.tokenExpiry &&
        Date.now() < authStatus.tokenExpiry;

      if (existingToken) {
        console.log(
          "Existing valid token found, attempting to refresh it silently"
        );
        try {
          await googleCalendarService.refreshToken();
          console.log("Token refreshed successfully");
        } catch (refreshErr) {
          console.log(
            "Silent token refresh failed, trying full authorization",
            refreshErr
          );
          await googleCalendarService.authorize();
        }
      } else {
        console.log("No existing token found, calling authorize() method");
        await googleCalendarService.authorize();
      }

      console.log("Authorization completed successfully");

      // Save auth data to Convex
      const tokenInfo = googleCalendarService.getTokenInfo();
      if (tokenInfo) {
        await saveAuthData({
          isAuthorized: true,
          accessToken: tokenInfo.accessToken,
          tokenExpiry: tokenInfo.expiryTime,
          refreshToken: tokenInfo.refreshToken,
        });
        console.log("Saved Google Calendar auth data to database");
      }

      setIsAuthorized(true);

      // Load events immediately after successful authentication
      try {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        console.log("Loading initial events after successful authentication");

        // We need to use a local function here to avoid circular dependency issues
        // This will be replaced with the proper fetchAllCalendarEvents call once it's defined
        const loadInitialEvents = async () => {
          try {
            // First fetch calendar list
            const calendarList = await googleCalendarService.listCalendars();
            setCalendars(calendarList);

            // Then fetch events from the primary calendar as a fallback
            const response = await googleCalendarService.listEvents(
              "primary",
              startDate.toISOString(),
              endDate.toISOString(),
              250
            );

            if (response && response.items) {
              setEvents(response.items);
              console.log(`Loaded ${response.items.length} initial events`);
            }
          } catch (error) {
            console.error("Error loading initial events:", error);
          }
        };

        // Start loading events in the background
        loadInitialEvents();
      } catch (err) {
        console.error("Failed to load initial events:", err);
      }
    } catch (err) {
      console.error("Authorization failed:", err);
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to connect to Google Calendar")
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiLoaded, apiLoadChecks, maxApiLoadChecks, saveAuthData, authStatus]);

  // Disconnect from Google Calendar
  const disconnectFromGoogleCalendar = useCallback(() => {
    console.log("Disconnecting from Google Calendar");
    googleCalendarService.signOut();

    // Revoke auth in Convex
    revokeAuth();
    console.log("Revoked Google Calendar auth in database");

    setIsAuthorized(false);
    setEvents([]);
    setCalendars(null);

    // Clear all Google Calendar caches
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log("Cleared all Google Calendar event caches");
  }, [revokeAuth]);

  // Check if Google API is loaded
  useEffect(() => {
    const checkApiLoaded = setInterval(() => {
      const isLoaded = googleCalendarService.isLoaded();

      if (isLoaded) {
        setApiLoaded(true);
        clearInterval(checkApiLoaded);
        console.log("Google Calendar API loaded successfully");

        // Try to restore authorization state on page load
        googleCalendarService.restoreAuthState();
      } else {
        // Increment check count
        setApiLoadChecks((prev) => {
          const newCount = prev + 1;

          // Log every 10 checks
          if (newCount % 10 === 0) {
            console.log(
              `Waiting for Google APIs to load... (${newCount}/${maxApiLoadChecks})`
            );
          }

          // Stop checking after max attempts
          if (newCount >= maxApiLoadChecks) {
            console.error("Timeout waiting for Google APIs to load");
            clearInterval(checkApiLoaded);
          }

          return newCount;
        });
      }
    }, 500);

    return () => clearInterval(checkApiLoaded);
  }, []);

  // Check authorization status from Convex and Google
  useEffect(() => {
    if (!apiLoaded) return;

    // Immediate check on component mount
    const immediateCheck = async () => {
      try {
        // First try restoring the auth state from the service
        googleCalendarService.restoreAuthState();

        // Get updated status after restore attempt
        const googleAuthStatus = googleCalendarService.getIsAuthorized();
        const convexAuthStatus = authStatus?.isAuthorized || false;

        console.log(
          "Initial auth check - Google:",
          googleAuthStatus,
          "Convex:",
          convexAuthStatus
        );

        if (googleAuthStatus || convexAuthStatus) {
          console.log("Found existing authorization, setting state");
          setIsAuthorized(true);

          // If we have convex status but not google status, we need to reconnect
          if (convexAuthStatus && !googleAuthStatus) {
            console.log(
              "Attempting to reconnect from saved Convex credentials"
            );
            try {
              await connectToGoogleCalendar();
            } catch (err) {
              console.error("Failed initial reconnection:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error during initial auth check:", err);
      }
    };

    // Run immediate check
    immediateCheck();

    // Set up the regular check
    const checkAuthStatus = async () => {
      // Get auth status from Google Calendar service
      const googleAuthStatus = googleCalendarService.getIsAuthorized();

      // Get auth status from Convex
      const convexAuthStatus = authStatus?.isAuthorized || false;
      const tokenExpiry = authStatus?.tokenExpiry || 0;

      console.log(
        "Auth status - Google:",
        googleAuthStatus,
        "Convex:",
        convexAuthStatus
      );

      // If token exists in Convex but Google doesn't know about it
      if (convexAuthStatus && !googleAuthStatus) {
        // Check if token is expired
        const now = Date.now();
        const isExpired = now >= tokenExpiry;

        if (isExpired) {
          console.log("Token is expired, attempting to reconnect...");
          // Will reconnect using the refresh token flow if possible
          try {
            await connectToGoogleCalendar();
          } catch (err) {
            console.error("Failed to reconnect with expired token:", err);
          }
        } else {
          console.log("Valid token exists in Convex, setting authorized state");
          setIsAuthorized(true);

          // Also attempt to reconnect to ensure Google service is aware
          try {
            await connectToGoogleCalendar();
          } catch (err) {
            console.error("Failed to reconnect with valid token:", err);
          }
        }
      }

      // If Google says authorized but Convex doesn't, save auth data
      if (googleAuthStatus && !convexAuthStatus) {
        const tokenInfo = googleCalendarService.getTokenInfo();
        if (tokenInfo) {
          try {
            await saveAuthData({
              isAuthorized: true,
              accessToken: tokenInfo.accessToken,
              tokenExpiry: tokenInfo.expiryTime,
              refreshToken: tokenInfo.refreshToken,
            });
            console.log("Saved Google Calendar auth data to database");
            setIsAuthorized(true);
          } catch (err) {
            console.error("Failed to save auth data to Convex:", err);
          }
        }
      }

      // Update state with combined status
      const newAuthStatus = googleAuthStatus || convexAuthStatus;
      if (newAuthStatus !== isAuthorized) {
        setIsAuthorized(newAuthStatus);
        console.log("Authorization status changed:", newAuthStatus);
      }
    };

    // Set up interval for periodic checks - more frequent checks
    const checkInterval = setInterval(checkAuthStatus, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [
    apiLoaded,
    authStatus,
    saveAuthData,
    connectToGoogleCalendar,
    isAuthorized,
  ]);

  // Special effect specifically to handle auth status changes from Convex
  // This ensures immediate reconnection when logging in from a new device
  useEffect(() => {
    // Only run if we have both API loaded and auth status from Convex
    if (!apiLoaded || authStatus === undefined) return;

    const convexAuthStatus = authStatus?.isAuthorized || false;
    const convexHasRefreshToken = !!(
      authStatus?.refreshToken && authStatus.refreshToken.length > 0
    );
    const googleAuthStatus = googleCalendarService.getIsAuthorized();

    console.log(
      "Auth status changed - Google:",
      googleAuthStatus,
      "Convex:",
      convexAuthStatus,
      "Has refresh token:",
      convexHasRefreshToken
    );

    // Automatically connect if we have Convex auth but not Google auth
    if (convexAuthStatus && !googleAuthStatus && convexHasRefreshToken) {
      console.log("Auto-connecting to Google Calendar after login");

      // Don't wait for the scheduled check, connect immediately
      (async () => {
        try {
          await connectToGoogleCalendar();
          console.log("Auto-connection successful");

          // Immediately fetch events for the current date after successful authentication
          const today = new Date();
          const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          const endDate = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            0
          );

          console.log("Auto-loading events after successful authentication");
          try {
            // Load events for current month to populate calendar views
            await fetchAllCalendarEvents(
              startDate.toISOString(),
              endDate.toISOString(),
              250
            );
            console.log("Initial events loaded automatically after login");
          } catch (eventsErr) {
            console.error("Failed to auto-load events:", eventsErr);
          }
        } catch (err) {
          console.error("Auto-connection failed:", err);
        }
      })();
    }
  }, [apiLoaded, authStatus, connectToGoogleCalendar]);

  // Fetch calendars when authorized
  useEffect(() => {
    if (isAuthorized) {
      fetchCalendars();
    }
  }, [isAuthorized]);

  // Fetch calendar list
  const fetchCalendars = useCallback(async () => {
    if (!isAuthorized) return;

    setIsLoading(true);
    setError(null);

    try {
      const calendarList = await googleCalendarService.listCalendars();
      setCalendars(calendarList);
      console.log("Calendars fetched:", calendarList.items.length);
    } catch (err) {
      console.error("Failed to fetch calendars:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch calendars")
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized]);

  // Refresh events from Google Calendar - Define this before fetchAllCalendarEvents
  const refreshEvents = useCallback(
    async (
      calendarId = "primary",
      timeMin = new Date().toISOString(),
      timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: number | string = 100,
      forceRefresh: boolean | string = false
    ) => {
      // Convert string parameters to their proper types if needed
      const parsedMaxResults =
        typeof maxResults === "string" ? parseInt(maxResults, 10) : maxResults;
      const parsedForceRefresh =
        typeof forceRefresh === "string"
          ? forceRefresh === "true"
          : forceRefresh;

      if (!isAuthorized) {
        try {
          await connectToGoogleCalendar();
        } catch (err) {
          return;
        }
      }

      // Generate cache key for this request
      const cacheKey = getCacheKey(calendarId, timeMin, timeMax);

      // Check cache first unless force refresh
      if (!parsedForceRefresh) {
        const cachedEvents = getFromCache(cacheKey);
        if (cachedEvents) {
          console.log(
            `Using ${cachedEvents.length} cached events instead of fetching`
          );
          setEvents(cachedEvents);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(`Fetching events from calendar: ${calendarId}`);
        console.log(
          `Time range: ${new Date(timeMin).toLocaleString()} to ${new Date(timeMax).toLocaleString()}`
        );

        const response = await googleCalendarService.listEvents(
          calendarId,
          timeMin,
          timeMax,
          parsedMaxResults
        );

        // Check if the response contains items
        if (!response || !response.items) {
          console.warn(
            "Received invalid response from Google Calendar:",
            response
          );
          setEvents([]);
          return;
        }

        const calendarEvents = response.items;

        // Store the events both in state and cache
        setEvents(calendarEvents);
        saveToCache(cacheKey, calendarEvents);

        console.log(`Events fetched: ${calendarEvents.length}`);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch events")
        );
        // Set empty events array on error
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthorized, connectToGoogleCalendar]
  );

  // Fetch all calendar events from all calendars
  const fetchAllCalendarEvents = useCallback(
    async (
      timeMin = new Date().toISOString(),
      timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults: number | string = 250,
      forceRefresh: boolean | string = false
    ) => {
      // Convert string parameters to their proper types if needed
      const parsedMaxResults =
        typeof maxResults === "string" ? parseInt(maxResults, 10) : maxResults;
      const parsedForceRefresh =
        typeof forceRefresh === "string"
          ? forceRefresh === "true"
          : forceRefresh;

      if (!isAuthorized) {
        try {
          await connectToGoogleCalendar();
        } catch (err) {
          console.error("Failed to connect to Google Calendar:", err);
          return [];
        }
      }

      // First make sure we have the list of calendars
      if (!calendars) {
        try {
          console.log("Fetching calendars before fetching events");
          await fetchCalendars();
        } catch (err) {
          console.error("Failed to fetch calendars:", err);
          // Try with just the primary calendar if we can't get the full list
          return refreshEvents(
            "primary",
            timeMin,
            timeMax,
            maxResults,
            forceRefresh
          );
        }
      }

      // If we still don't have calendars, just use primary
      if (!calendars || !calendars.items || calendars.items.length === 0) {
        console.log("No calendars found, using primary calendar only");
        return refreshEvents(
          "primary",
          timeMin,
          timeMax,
          maxResults,
          forceRefresh
        );
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log(`Fetching events from ${calendars.items.length} calendars`);

        // Generate a unique cache key for all calendars
        const allCalendarsCacheKey = `all_calendars_${timeMin}_${timeMax}`;

        // Check cache first unless force refresh
        if (!parsedForceRefresh) {
          const cachedEvents = getFromCache(allCalendarsCacheKey);
          if (cachedEvents) {
            console.log(
              `Using ${cachedEvents.length} cached events from all calendars instead of fetching`
            );
            setEvents(cachedEvents);
            setIsLoading(false);
            return;
          }
        }

        // Track all fetched events
        let allEvents: GoogleCalendarEvent[] = [];
        const enabledCalendars = calendars.items.filter(
          (cal) => cal.selected !== false
        );

        console.log(
          `Fetching events from ${enabledCalendars.length} enabled calendars`
        );

        // Log the calendars we're fetching from
        enabledCalendars.forEach((cal) => {
          console.log(`- ${cal.summary}${cal.primary ? " (primary)" : ""}`);
        });

        // Create an array of promises for each calendar fetch
        const fetchPromises = enabledCalendars.map((calendar) =>
          googleCalendarService
            .listEvents(calendar.id, timeMin, timeMax, parsedMaxResults)
            .then((response) => {
              console.log(
                `Calendar "${calendar.summary}" returned ${response.items.length} events`
              );

              // Add calendar info to each event
              const eventsWithCalendarInfo = response.items.map((event) => ({
                ...event,
                calendarId: calendar.id,
                calendarTitle: calendar.summary,
                calendarColor: calendar.backgroundColor || "#039be5",
              }));

              return eventsWithCalendarInfo;
            })
            .catch((err) => {
              console.error(
                `Error fetching events from calendar "${calendar.summary}":`,
                err
              );
              return [];
            })
        );

        // Wait for all fetches to complete
        const results = await Promise.all(fetchPromises);

        // Combine all results
        results.forEach((calendarEvents) => {
          allEvents = [...allEvents, ...calendarEvents];
        });

        console.log(
          `Total events fetched from all calendars: ${allEvents.length}`
        );

        // Store the events both in state and cache
        setEvents(allEvents);
        saveToCache(allCalendarsCacheKey, allEvents);

        setIsLoading(false);
        return allEvents;
      } catch (err) {
        console.error("Failed to fetch events from all calendars:", err);
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to fetch events from all calendars")
        );
        setEvents([]);
        setIsLoading(false);
        return [];
      }
    },
    [
      isAuthorized,
      connectToGoogleCalendar,
      fetchCalendars,
      calendars,
      refreshEvents,
    ]
  );

  return {
    isLoading,
    error,
    events,
    calendars,
    isAuthorized,
    connectToGoogleCalendar,
    disconnectFromGoogleCalendar,
    refreshEvents: fetchAllCalendarEvents,
  };
}
