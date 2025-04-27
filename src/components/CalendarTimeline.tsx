import { ChevronRight, ChevronLeft, X, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { GoogleCalendarEvent } from "../services/GoogleCalendarService";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

// Create a simplified type matching the events schema for better TypeScript support
interface Event {
  _id: string;
  title: string;
  startDate: number;
  endDate: number;
  description: string;
  location: string;
  category: string;
  isAllDay: boolean;
  color: string;
}

// Date utility functions
const formatDate = (date: Date): string => {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

const formatTime = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

  return `${formattedHours}:${formattedMinutes} ${ampm}`;
};

const addDays = (date: Date, days: number): Date => {
  const newDate = new Date(date);
  newDate.setDate(date.getDate() + days);
  return newDate;
};

const subDays = (date: Date, days: number): Date => {
  const newDate = new Date(date);
  newDate.setDate(date.getDate() - days);
  return newDate;
};

const startOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const endOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

// Convert Google Calendar event to our unified format
const convertGoogleEvent = (event: GoogleCalendarEvent): Event => {
  const startDateTime = event.start.dateTime || event.start.date || "";
  const endDateTime = event.end.dateTime || event.end.date || "";

  // Generate a color based on event summary if no color provided
  const defaultColor =
    "#" +
    Math.floor(
      Math.abs(
        (event.summary.charCodeAt(0) || 65) *
          (event.summary.charCodeAt(1) || 66)
      ) % 16777215
    )
      .toString(16)
      .padStart(6, "0");

  // Use the color from the event if available, otherwise use the generated one
  // First try to use the calendar-specific color if available from our calendar info extension
  let color = (event as any).calendarColor || defaultColor;

  // Then check if the event has a colorId
  if (event.colorId) {
    // Google Calendar color IDs are 1-11
    const colorMap: Record<string, string> = {
      "1": "#7986cb", // Lavender
      "2": "#33b679", // Sage
      "3": "#8e24aa", // Grape
      "4": "#e67c73", // Flamingo
      "5": "#f6bf26", // Banana
      "6": "#f4511e", // Tangerine
      "7": "#039be5", // Peacock
      "8": "#616161", // Graphite
      "9": "#3f51b5", // Blueberry
      "10": "#0b8043", // Basil
      "11": "#d60000", // Tomato
    };
    color = colorMap[event.colorId] || color;
  }

  // Parse event dates correctly, handling all-day events specially
  const parseEventDate = (dateStr: string, isEnd?: boolean) => {
    if (!dateStr) return new Date(0).getTime();

    // If it's just a date (all-day event), handle it specially to avoid timezone issues
    if (dateStr.length === 10) {
      // YYYY-MM-DD format for all-day events
      // Parse the date parts directly to avoid timezone conversion problems
      const [year, month, day] = dateStr.split("-").map(Number);

      // For all-day events, Google Calendar uses an exclusive end date
      // This means an event ending on "2023-06-15" actually ends at the start of that day
      // So for end dates, we need to subtract 1 day to get the actual inclusive end
      if (isEnd) {
        // Subtract 1 day for end dates of all-day events
        return new Date(year, month - 1, day - 1, 23, 59, 59, 999).getTime();
      }

      // Create a date that preserves the exact day (no timezone offset)
      // Month is 0-indexed in JavaScript Date
      return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
    }

    // For datetime strings, use the browser's timezone handling
    return new Date(dateStr).getTime();
  };

  return {
    _id: event.id,
    title: event.summary,
    description: event.description || "",
    startDate: parseEventDate(startDateTime, false),
    endDate: parseEventDate(endDateTime, true),
    location: event.location || "",
    isAllDay: !event.start.dateTime,
    color: color,
    category: (event as any).calendarTitle || "",
  };
};

export function CalendarTimeline({ onClose }: { onClose: () => void }) {
  // Use the actual system date
  const today = new Date();

  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const hasInitiallyLoaded = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  const previousDateRange = useRef("");
  const isFetchingRef = useRef(false);

  const {
    isLoading: isLoadingGoogle,
    events: googleEvents,
    isAuthorized,
    connectToGoogleCalendar,
    refreshEvents,
    error: googleError,
    isDebouncing,
  } = useGoogleCalendar();

  // Navigate to previous/next day
  const goToPrevious = () => {
    setSelectedDate((prev) => subDays(prev, 1));
  };

  const goToNext = () => {
    setSelectedDate((prev) => addDays(prev, 1));
  };

  // Convert Google Calendar events to our format
  useEffect(() => {
    if (googleEvents && googleEvents.length > 0 && isAuthorized) {
      try {
        const convertedEvents = googleEvents.map(convertGoogleEvent);
        // Sort by start time for consistency
        convertedEvents.sort((a, b) => a.startDate - b.startDate);

        // Only update if the data has actually changed
        if (JSON.stringify(convertedEvents) !== JSON.stringify(events)) {
          setEvents(convertedEvents);
        }
      } catch (err) {
        console.error("Error converting events:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to process events")
        );
        setEvents([]); // Clear events on conversion error
      }
    } else if (events.length > 0) {
      // Only clear events if we actually have some (avoids unnecessary rerenders)
      setEvents([]);
    }

    // Update loading state from the Google hook
    setIsLoadingEvents(isLoadingGoogle);

    // Handle Google errors
    if (googleError) {
      setError(googleError);
    }
  }, [googleEvents, isLoadingGoogle, isAuthorized, googleError, events]);

  // Fetch Google Calendar events when the selected date changes or auth status changes
  useEffect(() => {
    // Don't fetch if not authorized or already fetching
    if (!isAuthorized || isFetchingRef.current || isDebouncing) {
      setIsLoadingEvents(false);
      return;
    }

    const periodStart = startOfDay(selectedDate);
    const periodEnd = endOfDay(selectedDate);

    // Create a date range key to prevent duplicate fetches
    const dateRangeKey = `${periodStart.toISOString()}-${periodEnd.toISOString()}`;

    // Skip if this is the same range we just fetched
    if (
      previousDateRange.current === dateRangeKey &&
      hasInitiallyLoaded.current
    ) {
      console.log("Skipping fetch for same date range:", dateRangeKey);
      return;
    }

    console.log(`Fetching events for ${formatDate(selectedDate)}`);

    // Update state and refs
    setIsLoadingEvents(true);
    setError(null);
    previousDateRange.current = dateRangeKey;
    isFetchingRef.current = true;

    // Fetch all calendars for the given day
    refreshEvents(
      "primary", // calendarId should be first parameter
      periodStart.toISOString(), // timeMin
      periodEnd.toISOString(), // timeMax
      250, // maxResults
      !hasInitiallyLoaded.current // Only force refresh on the first load
    )
      .then(() => {
        hasInitiallyLoaded.current = true;
        // Loading state is handled by the googleEvents effect
      })
      .catch((err) => {
        console.error("Error fetching events:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch events")
        );
        setEvents([]); // Clear events on fetch error
        setIsLoadingEvents(false); // Ensure loading stops on error
      })
      .finally(() => {
        isFetchingRef.current = false;
      });
  }, [isAuthorized, refreshEvents, selectedDate, isDebouncing]);

  // Filter events for the selected day
  const filteredEvents = useMemo(() => {
    if (!events.length) return [];

    return events.filter((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const dayStart = startOfDay(selectedDate);
      const dayEnd = endOfDay(selectedDate);
      const eventStartTime = eventStart.getTime();
      const eventEndTime = eventEnd.getTime();
      const dayStartTime = dayStart.getTime();
      const dayEndTime = dayEnd.getTime();

      const isInRange =
        (eventStartTime >= dayStartTime && eventStartTime <= dayEndTime) ||
        (eventEndTime >= dayStartTime && eventEndTime <= dayEndTime) ||
        (eventStartTime <= dayStartTime && eventEndTime >= dayEndTime);

      return isInRange;
    });
  }, [events, selectedDate]);

  // Sort events by start time
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      // All-day events come first
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;

      // Then sort by start time
      return a.startDate - b.startDate;
    });
  }, [filteredEvents]);

  // Generate time blocks for the day (hourly from 7am to 10pm)
  const timeBlocks = Array.from({ length: 16 }, (_, i) => {
    const hour = i + 7; // Start at 7am
    return {
      time: hour,
      displayTime:
        hour > 12
          ? `${hour - 12}:00 PM`
          : hour === 12
            ? "12:00 PM"
            : `${hour}:00 AM`,
    };
  });

  // Helper to position events based on their time
  const getEventPosition = (timestamp: number) => {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minutes = date.getMinutes();
    // Calculate position based on time (60px per hour)
    const topOffset = (hour - 7) * 60 + minutes;
    return Math.max(0, topOffset); // Ensure we don't go negative
  };

  // Helper to calculate event height based on duration
  const getEventHeight = (startTimestamp: number, endTimestamp: number) => {
    const duration = endTimestamp - startTimestamp;
    const durationInMinutes = duration / (1000 * 60);
    return Math.max(30, durationInMinutes); // Minimum 30px height
  };

  // Helper to get default color if event has no color specified
  const getEventColor = (event: Event) => {
    return event.color || "#3b82f6"; // Default to blue if no color specified
  };

  // Loading state component
  const LoadingEvents = () => (
    <div className="flex flex-col items-center justify-center h-32 gap-2">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
      <p className="text-sm text-muted-foreground">Loading events...</p>
    </div>
  );

  return (
    <div className="w-96 border-l border-border h-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="text-lg font-medium">Today's Schedule</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between border-b p-4">
        <button
          onClick={goToPrevious}
          className="inline-flex items-center justify-center p-1 text-muted-foreground hover:text-foreground"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h4 className="text-sm font-medium">{formatDate(selectedDate)}</h4>
        <button
          onClick={goToNext}
          className="inline-flex items-center justify-center p-1 text-muted-foreground hover:text-foreground"
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Google Calendar controls */}
      {isAuthorized ? (
        <div className="px-4 py-2 border-b flex justify-between items-center">
          <Badge variant="default">Google Calendar</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isLoadingEvents || isDebouncing) return;

              setIsLoadingEvents(true);
              setError(null);
              const periodStart = startOfDay(selectedDate);
              const periodEnd = endOfDay(selectedDate);
              refreshEvents(
                "primary", // calendarId
                periodStart.toISOString(), // timeMin
                periodEnd.toISOString(), // timeMax
                250, // maxResults
                true // forceRefresh
              ).catch((err) => {
                setError(
                  err instanceof Error
                    ? err
                    : new Error("Failed to refresh events")
                );
                setIsLoadingEvents(false);
              });
            }}
            disabled={isLoadingEvents || isDebouncing}
            className="flex items-center gap-1"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoadingEvents ? "animate-spin" : ""}`}
            />
            <span className="text-xs">Refresh</span>
          </Button>
        </div>
      ) : (
        <div className="px-4 py-3 border-b bg-muted/20">
          <div className="text-sm mb-2">
            Connect to Google Calendar to see your events
          </div>
          <Button
            size="sm"
            onClick={() => connectToGoogleCalendar()}
            disabled={isLoadingGoogle}
            className="w-full"
          >
            {isLoadingGoogle ? (
              <>
                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Google Calendar"
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          Error: {error.message}
        </div>
      )}

      {/* Timeline Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* All-day events at the top */}
        {sortedEvents.some((e) => e.isAllDay) && (
          <div className="mb-4">
            <div className="text-xs font-medium mb-2 text-muted-foreground">
              ALL DAY
            </div>
            <div className="space-y-1">
              {sortedEvents
                .filter((e) => e.isAllDay)
                .map((event) => (
                  <div
                    key={event._id}
                    className="rounded p-2 shadow-sm"
                    style={{
                      backgroundColor: `${getEventColor(event)}20`,
                      borderLeft: `3px solid ${getEventColor(event)}`,
                    }}
                  >
                    <div
                      className="font-medium text-xs flex items-center gap-1"
                      style={{ color: getEventColor(event) }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {event.title}
                    </div>
                    {event.location && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        📍 {event.location}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Show a message when we've tried to load but got no events */}
        {googleEvents?.length === 0 && !isLoadingEvents && isAuthorized && (
          <div className="px-4 py-2 bg-yellow-100/50 text-yellow-800 text-sm rounded-md mb-4">
            No events found for {selectedDate.toLocaleDateString()} in Google
            Calendar.
            <br />
            <span className="text-xs">
              Try changing the date or refreshing.
            </span>
          </div>
        )}

        {!isAuthorized && !isLoadingEvents && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-muted-foreground text-center mb-4">
              Connect your Google Calendar to view your schedule
            </div>
          </div>
        )}

        {isLoadingEvents ? (
          <LoadingEvents />
        ) : (
          <div className="relative">
            {/* Time blocks */}
            {timeBlocks.map((block) => (
              <div
                key={block.time}
                className="flex items-start border-t border-border py-2 h-[60px] relative"
              >
                <div className="text-xs text-muted-foreground w-16 -mt-2 sticky left-0">
                  {block.displayTime}
                </div>
                <div className="flex-1 ml-2"></div>
              </div>
            ))}

            {/* Events */}
            <div className="absolute inset-0 pointer-events-none">
              {sortedEvents.map((event) => {
                // Skip all-day events for timeline view as they are shown separately above
                if (event.isAllDay) return null;

                const eventTop = getEventPosition(event.startDate);
                const eventHeight = getEventHeight(
                  event.startDate,
                  event.endDate
                );
                const eventColor = getEventColor(event);

                return (
                  <div
                    key={event._id}
                    className="absolute left-16 right-0 rounded overflow-hidden shadow-sm pointer-events-auto"
                    style={{
                      top: `${eventTop}px`,
                      height: `${eventHeight}px`,
                      backgroundColor: `${eventColor}20`,
                      borderLeft: `3px solid ${eventColor}`,
                    }}
                  >
                    <div className="p-2">
                      <div
                        className="font-medium text-xs truncate flex items-center gap-1"
                        style={{ color: eventColor }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        {event.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(new Date(event.startDate))} -{" "}
                        {formatTime(new Date(event.endDate))}
                      </div>
                      {event.location && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          📍 {event.location}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sortedEvents.length === 0 && !isLoadingEvents && isAuthorized && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No events scheduled for this day
          </div>
        )}
      </div>
    </div>
  );
}
