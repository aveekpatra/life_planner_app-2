import { useState, useEffect, useCallback } from "react";
import {
  GoogleCalendarService,
  GoogleCalendarEvent,
  GoogleCalendarList,
  googleCalendarService,
} from "../services/GoogleCalendarService";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

// No need to recreate the service; use the singleton instance from import
// const googleCalendarService = new GoogleCalendarService();

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
      // console.warn(`Cannot save undefined events to cache for key: ${key}`);
      return;
    }

    const cacheItem = {
      events,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cacheItem));
    // console.log(`Saved ${events.length} events to cache with key: ${key}`);
  } catch (err) {
    // console.error("Failed to save events to cache:", err);
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
      // console.log("Cache expired, removing:", key);
      localStorage.removeItem(key);
      return null;
    }

    // console.log(
    //   `Retrieved ${events.length} events from cache with key: ${key}`
    // );
    return events;
  } catch (err) {
    // console.error("Failed to retrieve events from cache:", err);
    return null;
  }
};

export function useGoogleCalendar(): UseGoogleCalendarReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<GoogleCalendarList | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [serviceReady, setServiceReady] = useState(false);

  // Convex mutations and queries
  const saveAuthData = useMutation(api.googleCalendarAuth.saveAuthData);
  const revokeAuth = useMutation(api.googleCalendarAuth.revokeAuth);
  const authStatus = useQuery(api.googleCalendarAuth.getAuthStatus);

  // Initialize and check for service readiness
  useEffect(() => {
    const checkServiceReady = () => {
      if (googleCalendarService.isLoaded()) {
        setServiceReady(true);

        // Check if already authorized
        const isAuth = googleCalendarService.getIsAuthorized();
        setIsAuthorized(isAuth);

        if (isAuth) {
          // If already authorized, load calendars in the background
          loadCalendars();
        }
      } else {
        setTimeout(checkServiceReady, 500);
      }
    };

    checkServiceReady();

    async function loadCalendars() {
      try {
        const calendarList = await googleCalendarService.listCalendars();
        setCalendars(calendarList);
      } catch (err: unknown) {
        // console.error("Failed to load calendars:", err);
      }
    }
  }, []);

  // Connect to Google Calendar
  const connectToGoogleCalendar = useCallback(async () => {
    if (!serviceReady) {
        setError(
          new Error(
          "Google Calendar service is not ready yet. Please wait and try again."
          )
        );
      return;
    }

    // console.log("Attempting to connect to Google Calendar...");
    setIsLoading(true);
    setError(null);

    try {
      await googleCalendarService.authorize();

      // Get the actual token from the service
      const accessToken = googleCalendarService.getAccessToken();

      // Save the actual token to Convex
              await saveAuthData({
                isAuthorized: true,
        accessToken: accessToken || "",
        tokenExpiry: Date.now() + 3600 * 1000, // Approximate 1hr expiry (milliseconds timestamp)
        refreshToken: "", // We don't use refresh tokens in client-side flow
      });

      // Force state update
              setIsAuthorized(true);
                console.log(
        "Authentication completed successfully, token:",
        !!accessToken
      );

      // Load calendars
      try {
        const calendarList = await googleCalendarService.listCalendars();
        console.log(
          "Calendars loaded successfully:",
          calendarList?.items?.length || 0
        );
        setCalendars(calendarList);
      } catch (calendarErr: unknown) {
        // console.error("Error loading calendars:", calendarErr);
      }

      // Load initial events
      const today = new Date();
      const start = startOfMonth(today);
      const end = endOfMonth(today);

      // console.log("Loading initial events after successful authentication");

      try {
            const response = await googleCalendarService.listEvents(
              "primary",
          start.toISOString(),
          end.toISOString(),
              250
            );

            if (response && response.items) {
              setEvents(response.items);
          // console.log(`Loaded ${response.items.length} initial events`);

          // Cache the events
          const cacheKey = getCacheKey(
            "primary",
            start.toISOString(),
            end.toISOString()
          );
          saveToCache(cacheKey, response.items);
        }
      } catch (eventsErr: unknown) {
        // console.error("Error loading initial events:", eventsErr);
      }
    } catch (err: unknown) {
      // console.error("Error connecting to Google Calendar:", err);
      setError(
        new Error(
          `Failed to connect to Google Calendar: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [serviceReady, saveAuthData]);

  // Disconnect from Google Calendar
  const disconnectFromGoogleCalendar = useCallback(() => {
    // console.log("Disconnecting from Google Calendar");

    // Sign out from the service
    googleCalendarService.signOut();

    // Update state
    setIsAuthorized(false);
    setEvents([]);
    setCalendars(null);

    // Clear from Convex
    revokeAuth();

    // Clear all event caches
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });

    // console.log("Disconnected from Google Calendar successfully");
  }, [revokeAuth]);

  // Refresh events
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
        console.log(`Refreshing events with params:`, {
          calendarId,
          timeMin,
          timeMax,
          maxResults,
          forceRefresh,
        });

        setIsLoading(true);

        // Default to current month if no time range specified
        if (!timeMin || !timeMax) {
          const now = new Date();
          const monthStart = startOfMonth(now);
          const monthEnd = endOfMonth(now);

          timeMin = timeMin || monthStart.toISOString();
          timeMax = timeMax || monthEnd.toISOString();
        }

        // Check cache first
      const cacheKey = getCacheKey(calendarId, timeMin, timeMax);
        const cachedEvents = !forceRefresh ? getFromCache(cacheKey) : null;

        if (cachedEvents) {
          console.log("Using cached events:", cachedEvents.length);
          setEvents(cachedEvents);
        } else {
          console.log("Fetching fresh events from API");
        const response = await googleCalendarService.listEvents(
          calendarId,
          timeMin,
          timeMax,
            maxResults
          );

          if (response && response.items) {
            console.log(`Fetched ${response.items.length} events from API`);
            setEvents(response.items);

            // Cache the results
            saveToCache(cacheKey, response.items);
          } else {
            console.log("No events returned from API");
          setEvents([]);
          }
        }
      } catch (err: unknown) {
        console.error("Error refreshing events:", err);
        setError(
          new Error(
            `Failed to refresh events: ${err instanceof Error ? err.message : "Unknown error"}`
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthorized]
  );

  // Check auth status from Convex on initial load
  useEffect(() => {
    if (!authStatus || !serviceReady) return;

    // Add debug logging
    console.log("Auth status from Convex:", authStatus);
    console.log(
      "Current auth state in service:",
      googleCalendarService.getIsAuthorized()
    );
    console.log(
      "Access token present:",
      !!googleCalendarService.getAccessToken()
    );

    // Only attempt to restore state if not already loading or authorized
    if (authStatus.isAuthorized && !isAuthorized && !isLoading) {
      console.log("Convex indicates we should be authorized, restoring state");

      // Use a local variable to avoid triggering another update
      const currentAuthState = googleCalendarService.getIsAuthorized();
      if (!currentAuthState) {
        try {
          // Try to restore authorization without causing re-renders
          googleCalendarService.restoreAuthState();

          // Only update React state if there's actually a change
          const newAuthState = googleCalendarService.getIsAuthorized();
          console.log("After restore attempt, new auth state:", newAuthState);

          if (newAuthState !== isAuthorized) {
            setIsAuthorized(newAuthState);
          }
        } catch (error) {
          console.error("Error restoring auth state:", error);
        }
      }
    }
    // Add isLoading as a dependency to prevent the effect from running during loading
  }, [authStatus, isAuthorized, serviceReady, isLoading]);

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
