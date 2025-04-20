import { useState, useEffect, useCallback } from "react";
import {
  googleCalendarService,
  GoogleCalendarEvent,
  GoogleCalendarList,
} from "../services/GoogleCalendarService";
import { useMutation, useQuery } from "../convex/_generated/react";
import { api } from "../convex/_generated/api";

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
const saveToCache = (key: string, events: GoogleCalendarEvent[]) => {
  try {
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

  // Check if Google API is loaded
  useEffect(() => {
    const checkApiLoaded = setInterval(() => {
      const isLoaded = googleCalendarService.isLoaded();

      if (isLoaded) {
        setApiLoaded(true);
        clearInterval(checkApiLoaded);
        console.log("Google Calendar API loaded successfully");
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

    const checkAuthStatus = setInterval(() => {
      const googleAuthStatus = googleCalendarService.getIsAuthorized();
      const convexAuthStatus = authStatus?.isAuthorized || false;

      // If either source shows authorized, consider the user authorized
      const newAuthStatus = googleAuthStatus || convexAuthStatus;

      if (newAuthStatus !== isAuthorized) {
        setIsAuthorized(newAuthStatus);
        console.log("Authorization status changed:", newAuthStatus);

        // If Google says authorized but Convex doesn't, save auth data
        if (googleAuthStatus && !convexAuthStatus) {
          const tokenInfo = googleCalendarService.getTokenInfo();
          if (tokenInfo) {
            saveAuthData({
              isAuthorized: true,
              accessToken: tokenInfo.accessToken,
              tokenExpiry: tokenInfo.expiryTime,
              refreshToken: tokenInfo.refreshToken,
            });
            console.log("Saved Google Calendar auth data to database");
          }
        }
      }
    }, 1000);

    return () => clearInterval(checkAuthStatus);
  }, [apiLoaded, isAuthorized, authStatus, saveAuthData]);

  // Fetch calendars when authorized
  useEffect(() => {
    if (isAuthorized) {
      fetchCalendars();
    }
  }, [isAuthorized]);

  // Connect to Google Calendar
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
      console.log("Calling authorize() method");
      await googleCalendarService.authorize();
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
  }, [apiLoaded, apiLoadChecks, maxApiLoadChecks, saveAuthData]);

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

  // Refresh events from Google Calendar
  const refreshEvents = useCallback(
    async (
      calendarId = "primary",
      timeMin = new Date().toISOString(),
      timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxResults = 100,
      forceRefresh = false
    ) => {
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
      if (!forceRefresh) {
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

        const calendarEvents = await googleCalendarService.listEvents(
          calendarId,
          timeMin,
          timeMax,
          maxResults
        );

        // Store the events both in state and cache
        setEvents(calendarEvents);
        saveToCache(cacheKey, calendarEvents);

        console.log(`Events fetched: ${calendarEvents.length}`);
      } catch (err) {
        console.error("Failed to fetch events:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch events")
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthorized, connectToGoogleCalendar]
  );

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
