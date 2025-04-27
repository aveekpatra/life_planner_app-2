import { useState, useEffect, useCallback, useRef } from "react";
import {
  GoogleCalendarEvent,
  GoogleCalendarList,
} from "../services/GoogleCalendarService";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

// Get the browser's timezone
const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
  clearError: () => void;
  isDebouncing: boolean;
}

// Cache management for Google Calendar events
const CACHE_KEY_PREFIX = "google_calendar_events_";
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes - reduced from 10 minutes for fresher data
const DEBOUNCE_DELAY = 500; // 500ms debounce for event fetching

// Helper function to do deep comparison of arrays or objects
const isEqual = (a: any, b: any): boolean => {
  return JSON.stringify(a) === JSON.stringify(b);
};

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
    localStorage.removeItem(key); // Remove corrupted cache item
    return null;
  }
};

// Helper function to validate and normalize dates
const validateAndNormalizeDates = (timeMin?: string, timeMax?: string) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  // Default to current month if no time range specified
  if (!timeMin || !timeMax) {
    // Use current date, not future date
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return {
      timeMin: monthStart.toISOString(),
      timeMax: monthEnd.toISOString(),
    };
  }

  // Validate provided dates
  try {
    const minDate = new Date(timeMin);
    const maxDate = new Date(timeMax);

    // Check for unreasonable dates (future years)
    if (
      minDate.getFullYear() > currentYear ||
      maxDate.getFullYear() > currentYear
    ) {
      console.warn(
        `Detected future date range: ${timeMin} to ${timeMax}, using current month instead`
      );

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      return {
        timeMin: monthStart.toISOString(),
        timeMax: monthEnd.toISOString(),
      };
    }

    // If dates are valid, return them unchanged
    return { timeMin, timeMax };
  } catch (error) {
    // If there's any parsing error, default to current month
    console.warn("Error parsing dates, using current month instead");
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    return {
      timeMin: monthStart.toISOString(),
      timeMax: monthEnd.toISOString(),
    };
  }
};

export function useGoogleCalendar(): UseGoogleCalendarReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendarList | null>(null);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Refs for tracking state and preventing unnecessary rerenders
  const eventsInitialized = useRef(false);
  const hasAttemptedInitialLoad = useRef(false);
  const currentFetchRequest = useRef<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastFetchParams = useRef<{
    calendarId: string;
    timeMin: string;
    timeMax: string;
    timestamp: number;
  } | null>(null);

  // Function to clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

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

  // Clear error when auth status changes
  useEffect(() => {
    if (error && !isAuthorized) {
      setError(null);
    }
  }, [isAuthorized, error]);

  // Disconnect from Google Calendar
  const disconnectFromGoogleCalendar = useCallback(() => {
    // Clear from Convex
    revokeAuth()
      .then(() => {
        console.log("Successfully revoked Google Calendar authorization");
      })
      .catch((err) => {
        console.error("Error revoking authorization:", err);
      });

    // Clear local state
    if (events.length > 0) {
      setEvents([]);
    }
    setCalendars(null);
    setError(null);
    eventsInitialized.current = false;
    hasAttemptedInitialLoad.current = false;

    // Clear all event caches
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });

    // Clear any pending debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      setIsDebouncing(false);
    }
  }, [revokeAuth, events.length]);

  // Refresh events - Define this function BEFORE it's used in any useEffect
  const refreshEvents = useCallback(
    async (
      calendarId = "primary",
      timeMin?: string,
      timeMax?: string,
      maxResults = 250,
      forceRefresh = false
    ) => {
      // Don't proceed if not authorized
      if (!isAuthorized) {
        console.log("Not authorized to refresh events");
        return;
      }

      // Clear any previous debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }

      // Set debouncing state
      setIsDebouncing(true);

      // Create a debounced execution
      return new Promise<void>((resolve, reject) => {
        debounceTimer.current = setTimeout(async () => {
          try {
            // Validate and normalize dates - use our helper function instead of inline logic
            const validatedDates = validateAndNormalizeDates(timeMin, timeMax);
            timeMin = validatedDates.timeMin;
            timeMax = validatedDates.timeMax;

            // Check if this is a duplicate request with the same parameters
            const requestKey = `all-calendars:${timeMin}:${timeMax}`;

            if (
              !forceRefresh &&
              lastFetchParams.current &&
              lastFetchParams.current.calendarId === "all-calendars" &&
              lastFetchParams.current.timeMin === timeMin &&
              lastFetchParams.current.timeMax === timeMax &&
              Date.now() - lastFetchParams.current.timestamp < CACHE_EXPIRY_MS
            ) {
              console.log("Skipping duplicate request with same parameters");
              setIsDebouncing(false);
              resolve();
              return;
            }

            // Update current request tracking
            currentFetchRequest.current = requestKey;

            // If we're forcing refresh, don't use cache
            const cacheKey = getCacheKey("all-calendars", timeMin, timeMax);

            let cachedEvents = null;
            if (!forceRefresh) {
              cachedEvents = getFromCache(cacheKey);
            }

            // Use cached events if available
            if (cachedEvents) {
              console.log(`Using ${cachedEvents.length} events from cache`);

              // Only update state if events are different
              if (!isEqual(cachedEvents, events)) {
                setEvents(cachedEvents);
              }

              setIsLoading(false);
              setIsDebouncing(false);

              // Store last fetch parameters
              lastFetchParams.current = {
                calendarId: "all-calendars",
                timeMin,
                timeMax,
                timestamp: Date.now(),
              };

              resolve();
              return;
            }

            // If we got here, we need to fetch fresh data
            setIsLoading(true);

            // Get access token from backend with retry logic
            console.log("Getting access token for events refresh");
            let accessToken;
            let retryCount = 0;

            while (retryCount < 2) {
              try {
                const tokenResult = await getAccessToken();
                if (tokenResult.success && tokenResult.accessToken) {
                  accessToken = tokenResult.accessToken;
                  break;
                } else {
                  console.warn("Failed to get access token, retrying...");
                  // Wait a second before retrying
                  await new Promise((r) => setTimeout(r, 1000));
                  retryCount++;
                }
              } catch (error) {
                console.error("Error getting access token:", error);
                retryCount++;
                // Wait a second before retrying
                await new Promise((r) => setTimeout(r, 1000));
              }
            }

            if (!accessToken) {
              // If we failed to get a token even after retries
              throw new Error(
                "Failed to get access token after multiple attempts"
              );
            }

            // Get calendar list to ensure we fetch from all calendars
            console.log("Getting auth status to fetch calendar IDs");
            const authStatus = await getAccessToken();

            // Get the list of calendars to fetch from
            const calendarIds = authStatus.calendarIds || [
              calendarId || "primary",
            ];
            console.log(
              `Fetching events from ${calendarIds.length} calendars: ${calendarIds.join(", ")}`
            );

            // Fetch events from all calendars in parallel
            const allEventsPromises = calendarIds.map(async (calId) => {
              console.log(
                `Fetching events for ${calId} from ${timeMin} to ${timeMax}`
              );

              const url = new URL(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`
              );

              url.searchParams.append("maxResults", maxResults.toString());
              url.searchParams.append("timeMin", timeMin);
              url.searchParams.append("timeMax", timeMax);
              url.searchParams.append("singleEvents", "true");
              url.searchParams.append("orderBy", "startTime");
              url.searchParams.append("timeZone", localTimeZone);

              try {
                const response = await fetch(url.toString(), {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                });

                if (!response.ok) {
                  console.error(
                    `Error fetching events from calendar ${calId}: ${response.status} ${response.statusText}`
                  );
                  return [];
                }

                const data = await response.json();

                // Try to get calendar information to add to events
                try {
                  const calResponse = await fetch(
                    `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calId)}`,
                    {
                      headers: {
                        Authorization: `Bearer ${accessToken}`,
                      },
                    }
                  );

                  if (calResponse.ok) {
                    const calData = await calResponse.json();
                    // Add calendar information to each event
                    return (data.items || []).map((event: any) => ({
                      ...event,
                      calendarTitle: calData.summary,
                      calendarColor: calData.backgroundColor,
                    }));
                  }
                } catch (calError) {
                  console.error(
                    `Error fetching calendar details for ${calId}:`,
                    calError
                  );
                }

                return data.items || [];
              } catch (error) {
                console.error(
                  `Error fetching events from calendar ${calId}:`,
                  error
                );
                return [];
              }
            });

            // Wait for all calendar requests to complete
            const allEventsArrays = await Promise.all(allEventsPromises);

            // Combine all events into a single array and sort by start time
            const combinedEvents = allEventsArrays.flat().sort((a, b) => {
              const aStart = a.start.dateTime || a.start.date || "";
              const bStart = b.start.dateTime || b.start.date || "";
              return aStart.localeCompare(bStart);
            });

            console.log(
              `Retrieved ${combinedEvents.length} events from ${calendarIds.length} calendars`
            );

            // If this was canceled or a newer request came in, don't update state
            if (currentFetchRequest.current !== requestKey) {
              console.log("Request was superseded by a newer request");
              setIsLoading(false);
              setIsDebouncing(false);
              resolve();
              return;
            }

            // Save to cache
            saveToCache(cacheKey, combinedEvents);

            // Only update state if events are different to avoid unnecessary rerenders
            if (!isEqual(combinedEvents, events)) {
              setEvents(combinedEvents);
            }

            // Store last fetch parameters
            lastFetchParams.current = {
              calendarId: "all-calendars",
              timeMin,
              timeMax,
              timestamp: Date.now(),
            };

            setIsLoading(false);
            resolve();
          } catch (err) {
            console.error("Error refreshing events:", err);
            setError(
              err instanceof Error
                ? err
                : new Error("An error occurred while fetching events")
            );
            setIsLoading(false);
            reject(err);
          } finally {
            setIsDebouncing(false);
            debounceTimer.current = null;
          }
        }, DEBOUNCE_DELAY);
      });
    },
    [isAuthorized, getAccessToken, events, revokeAuth]
  );

  // Handle direct auth events
  useEffect(() => {
    const handleDirectAuth = (event: CustomEvent) => {
      console.log("Received direct auth event:", event.detail);

      // Don't handle auth events if we're loading or not initialized properly
      if (isLoading) {
        console.log("Ignoring direct auth during loading state");
        return;
      }

      // Extract the code from the event detail
      const { code } = event.detail || {};
      if (!code) {
        console.error("No code found in direct auth event");
        return;
      }

      console.log("Exchanging code from direct auth event");
      setIsLoading(true);

      // Exchange the code for tokens
      exchangeCodeForTokens({ code })
        .then((result) => {
          console.log("Token exchange result:", result);

          if (result.success) {
            eventsInitialized.current = false;
            hasAttemptedInitialLoad.current = false;

            if (result.calendars) {
              setCalendars({
                kind: "calendar#calendarList",
                etag: "",
                nextSyncToken: "",
                items: result.calendars,
              });
            }
          } else {
            throw new Error(
              result.message || "Failed to authenticate with Google Calendar"
            );
          }
        })
        .catch((err) => {
          console.error("Error during token exchange:", err);
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to authenticate with Google Calendar")
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    // Add the event listener
    console.log("Adding GOOGLE_AUTH_DIRECT event listener");
    window.addEventListener(
      "GOOGLE_AUTH_DIRECT",
      handleDirectAuth as EventListener
    );

    // Cleanup
    return () => {
      console.log("Removing GOOGLE_AUTH_DIRECT event listener");
      window.removeEventListener(
        "GOOGLE_AUTH_DIRECT",
        handleDirectAuth as EventListener
      );
    };
  }, [exchangeCodeForTokens, isLoading]);

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
          eventsInitialized.current = false;
          hasAttemptedInitialLoad.current = false;

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
  }, [getAuthUrl, exchangeCodeForTokens, isLoading]);

  // Initial events loading
  useEffect(() => {
    // Only attempt to fetch events when all conditions are met
    // and prevent running on every render
    if (
      isAuthorized &&
      !isLoading &&
      !isDebouncing &&
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
            // Use current month for the initial load rather than a potentially future date
            const now = new Date();
            const start = startOfMonth(now);
            const end = endOfMonth(now);

            await refreshEvents(
              undefined, // No need to specify calendar ID, it will use all calendars
              start.toISOString(),
              end.toISOString(),
              250, // maxResults
              true // forceRefresh to bypass cache
            );
          } catch (err) {
            console.error("Error loading initial events:", err);
          }
        };

        // Execute but don't create a dependency on the Promise
        void fetchInitialEvents();
      }
    }
  }, [isAuthorized, isLoading, isDebouncing, events.length, error]); // Removing refreshEvents from dependencies

  return {
    isLoading,
    error,
    events,
    calendars,
    isAuthorized,
    connectToGoogleCalendar,
    disconnectFromGoogleCalendar,
    refreshEvents,
    clearError,
    isDebouncing,
  };
}
