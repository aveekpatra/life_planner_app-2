import { useState, useEffect, useCallback, useRef } from "react";
import {
  GoogleCalendarEvent,
  GoogleCalendarList,
} from "../services/GoogleCalendarService";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

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
      return;
    }

    const cacheItem = {
      events,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
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
      localStorage.removeItem(key);
      return null;
    }

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

  // Add the missing ref initialization
  const eventsInitialized = useRef(false);
  // Move the hasAttemptedInitialLoad ref to the top level
  const hasAttemptedInitialLoad = useRef(false);

  // Convex mutations, queries and actions - ensure they're always called
  const revokeAuth = useMutation(api.googleCalendarAuth.revokeAuth);
  const authStatusResult = useQuery(api.googleCalendarAuth.getAuthStatus) || {
    isAuthorized: false,
  };
  const getAuthUrl = useAction(api.googleCalendarAuth.getAuthUrl);
  const exchangeCodeForTokens = useAction(
    api.googleCalendarAuth.exchangeCodeForTokens
  );
  const getAccessToken = useAction(api.googleCalendarAuth.getAccessToken);

  // Derive authorized state from the query result, not the raw query
  const isAuthorized = authStatusResult?.isAuthorized || false;

  // Disconnect from Google Calendar
  const disconnectFromGoogleCalendar = useCallback(() => {
    // Clear from Convex
    revokeAuth();

    // Clear local state
    setEvents([]);
    setCalendars(null);

    // Clear all event caches
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }, [revokeAuth]);

  // Refresh events - Define this function BEFORE it's used in any useEffect
  const refreshEvents = useCallback(
    async (
      calendarId = "primary",
      timeMin?: string,
      timeMax?: string,
      maxResults = 250,
      forceRefresh = false
    ) => {
      if (!isAuthorized) {
        console.log("Not authorized to refresh events");
        return;
      }

      try {
        setIsLoading(true);

        // Default to current month if no time range specified
        if (!timeMin || !timeMax) {
          const now = new Date();
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);

          timeMin = timeMin || monthStart.toISOString();
          timeMax = timeMax || monthEnd.toISOString();
        }

        console.log(`Refreshing events for calendar: ${calendarId}`);
        console.log(`Time range: ${timeMin} to ${timeMax}`);

        // Check cache first
        const cacheKey = getCacheKey(calendarId, timeMin, timeMax);
        const cachedEvents = !forceRefresh ? getFromCache(cacheKey) : null;

        if (cachedEvents) {
          console.log(`Using ${cachedEvents.length} cached events`);
          // Only update state if the events are different
          if (JSON.stringify(cachedEvents) !== JSON.stringify(events)) {
            setEvents(cachedEvents);
          }
        } else {
          // Get a fresh access token
          const tokenResult = await getAccessToken();

          if (!tokenResult.success) {
            throw new Error(tokenResult.error || "Failed to get access token");
          }

          // Make request to Google Calendar API
          const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
          console.log(`Making API request to: ${apiUrl}`);

          const url = new URL(apiUrl);
          url.searchParams.append("maxResults", maxResults.toString());
          url.searchParams.append("timeMin", timeMin);
          url.searchParams.append("timeMax", timeMax);
          url.searchParams.append("singleEvents", "true");
          url.searchParams.append("orderBy", "startTime");

          const requestUrl = url.toString();
          console.log(`Full request URL: ${requestUrl}`);

          const response = await fetch(requestUrl, {
            headers: {
              Authorization: `Bearer ${tokenResult.accessToken}`,
            },
          });

          if (!response.ok) {
            console.error(
              `API error (${response.status}): ${response.statusText}`
            );
            throw new Error(`Failed to fetch events: ${response.statusText}`);
          }

          const data = await response.json();
          console.log(`Received ${data?.items?.length || 0} events from API`);

          if (data && data.items) {
            // Only update if the data has actually changed
            const newEvents = data.items;
            if (JSON.stringify(newEvents) !== JSON.stringify(events)) {
              setEvents(newEvents);
              saveToCache(cacheKey, newEvents);
            }
          } else if (events.length > 0) {
            // Only set to empty if we currently have events
            setEvents([]);
          }
        }
      } catch (err: any) {
        console.error("Error refreshing events:", err);
        setError(new Error(err.message || "Failed to refresh events"));
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthorized, getAccessToken, events]
  );

  // Add a handler for direct auth events that may come from the router
  useEffect(() => {
    // Define the event handler as a regular function, NOT using useCallback
    const handleDirectAuth = (event: CustomEvent) => {
      if (event.detail && event.detail.code) {
        console.log("Received direct auth code, processing...");

        // Exchange the code for tokens
        exchangeCodeForTokens({ code: event.detail.code })
          .then((result) => {
            if (result.success) {
              console.log("Direct auth token exchange successful");
              // Refresh events
              const today = new Date();
              const start = startOfMonth(today);
              const end = endOfMonth(today);

              refreshEvents(
                "primary",
                start.toISOString(),
                end.toISOString(),
                250
              );

              // Set calendars if available
              if (result.calendars) {
                setCalendars({
                  kind: "calendar#calendarList",
                  etag: "",
                  nextSyncToken: "",
                  items: result.calendars,
                });
              }
            } else {
              console.error(
                "Direct auth token exchange failed:",
                result.message
              );
            }
          })
          .catch((err) => {
            console.error("Error in direct auth flow:", err);
          });
      }
    };

    // Listen for direct auth events
    window.addEventListener(
      "GOOGLE_AUTH_DIRECT",
      handleDirectAuth as EventListener
    );

    return () => {
      window.removeEventListener(
        "GOOGLE_AUTH_DIRECT",
        handleDirectAuth as EventListener
      );
    };
  }, [exchangeCodeForTokens, refreshEvents, setCalendars]); // Include all dependencies

  // Connect to Google Calendar
  const connectToGoogleCalendar = useCallback(async () => {
    // Prevent duplicate calls if already loading
    if (isLoading) {
      console.log("Already loading, skipping connection attempt");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the auth URL
      console.log("Getting Google auth URL...");
      const authUrl = await getAuthUrl();
      console.log("Received auth URL:", authUrl);

      // Open a popup window for the OAuth flow
      const width = 600;
      const height = 600;
      const left = window.innerWidth / 2 - width / 2;
      const top = window.innerHeight / 2 - height / 2;

      console.log("Opening OAuth popup...");
      const popup = window.open(
        authUrl,
        "Google Calendar Authorization",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        console.error("Popup blocked by browser!");
        throw new Error("Popup blocked. Please allow popups for this site.");
      }

      console.log("Popup opened successfully, waiting for authorization...");

      // Create a promise that resolves when the OAuth flow completes
      const authPromise = new Promise<string>((resolve, reject) => {
        // Function to handle the callback redirect
        const handleRedirect = async (event: MessageEvent) => {
          console.log("Message received:", event);

          // Ensure the message is from our application
          if (event.origin !== window.location.origin) {
            console.log("Ignored message from different origin:", event.origin);
            return;
          }

          console.log("Received message from callback window:", event.data);

          // Check if the message contains the authorization code - handle both formats
          if (event.data && typeof event.data === "object") {
            // Format 1: { type: "GOOGLE_AUTH_CALLBACK", code: "..." }
            if (event.data.type === "GOOGLE_AUTH_CALLBACK" && event.data.code) {
              console.log("Received code via GOOGLE_AUTH_CALLBACK format");
              window.removeEventListener("message", handleRedirect);
              resolve(event.data.code as string);
              popup.close();
              return;
            }

            // Format 2: { code: "..." } - simplified format
            if ("code" in event.data) {
              console.log("Received code via simplified format");
              window.removeEventListener("message", handleRedirect);
              resolve(event.data.code as string);
              popup.close();
              return;
            }
          }
        };

        // Listen for message from the popup
        console.log("Adding message event listener");
        window.addEventListener("message", handleRedirect);

        // Handle popup being closed without completing auth
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            console.log("Popup was closed by user before completion");
            clearInterval(checkClosed);
            window.removeEventListener("message", handleRedirect);
            reject(new Error("Authorization was cancelled"));
          }
        }, 500);
      });

      // Wait for the authorization code
      const code = await authPromise;
      console.log("Authorization code received, exchanging for tokens...");

      // Exchange code for tokens
      try {
        console.log(
          "Calling exchangeCodeForTokens with code:",
          code.substring(0, 10) + "..."
        );
        const result = await exchangeCodeForTokens({ code });
        console.log("Token exchange result:", result);

        if (result.success) {
          console.log("Token exchange successful");

          // Only refresh events if we need to - don't do it immediately here
          // This avoids potential double-loads with the useEffect
          if (result.calendars) {
            console.log("Setting calendars:", result.calendars.length);
            setCalendars({
              kind: "calendar#calendarList",
              etag: "",
              nextSyncToken: "",
              items: result.calendars,
            });
          } else {
            console.log("No calendars data returned from token exchange");
          }
        } else {
          console.error("Token exchange failed:", result);
          throw new Error(
            result.message || "Failed to authenticate with Google Calendar"
          );
        }
      } catch (exchErr) {
        console.error("Error during token exchange:", exchErr);
        throw exchErr;
      }
    } catch (err: any) {
      console.error("Error connecting to Google Calendar:", err);
      setError(
        new Error(err.message || "Failed to connect to Google Calendar")
      );
    } finally {
      setIsLoading(false);
    }
  }, [getAuthUrl, exchangeCodeForTokens, isLoading, setCalendars]);

  // Initial events loading
  useEffect(() => {
    // Only attempt to fetch events when all conditions are met
    // and prevent running on every render
    if (
      isAuthorized &&
      !isLoading &&
      events.length === 0 &&
      !error &&
      !hasAttemptedInitialLoad.current
    ) {
      console.log("Initial events loading conditions met");
      hasAttemptedInitialLoad.current = true;

      // Only use the eventsInitialized ref for persistent storage
      if (!eventsInitialized.current) {
        console.log("Initial events loading started");
        eventsInitialized.current = true;

        // Call refreshEvents in a way that doesn't create dependencies
        const fetchInitialEvents = async () => {
          try {
            const today = new Date();
            const start = startOfMonth(today);
            const end = endOfMonth(today);

            await refreshEvents(
              "primary",
              start.toISOString(),
              end.toISOString()
            );
          } catch (err) {
            console.error("Error loading initial events:", err);
          }
        };

        // Execute but don't create a dependency on the Promise
        void fetchInitialEvents();
      }
    }
  }, [isAuthorized, isLoading, events.length, error]); // Removing refreshEvents from dependencies

  return {
    isLoading,
    error,
    events,
    calendars,
    isAuthorized,
    connectToGoogleCalendar,
    disconnectFromGoogleCalendar,
    refreshEvents,
  };
}
