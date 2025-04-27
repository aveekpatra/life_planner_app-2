import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { CalendarDays, CalendarRange, RefreshCw } from "lucide-react";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { GoogleCalendarEvent } from "../services/GoogleCalendarService";
import {
  format,
  getDaysInMonth,
  getDay,
  addMonths,
  subMonths,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
  differenceInMinutes,
  endOfMonth,
  add,
} from "date-fns";

// Helper function to get start and end date of a week for a given date
const getWeekRange = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday as first day of week
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return { start, end };
};

// Day names for header
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type CalendarView = "month" | "week";

// Convert Google Calendar event to unified format
const convertGoogleEvent = (event: GoogleCalendarEvent) => {
  const startDateTime = event.start.dateTime || event.start.date || "";
  const endDateTime = event.end.dateTime || event.end.date || "";

  // Generate a color based on event summary
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

  // Use the color from the event if available
  let color = (event as any).calendarColor || defaultColor;

  // Check if the event has a colorId
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

  return {
    _id: event.id,
    title: event.summary,
    description: event.description || "",
    startDate: new Date(startDateTime).getTime(),
    endDate: new Date(endDateTime).getTime(),
    location: event.location || "",
    isAllDay: !event.start.dateTime,
    color: color,
    category: (event as any).calendarTitle || "Google Calendar",
  };
};

// Generate calendar rows
const generateCalendarRows = (month: number, year: number) => {
  const daysInMonth = getDaysInMonth(new Date(year, month, 1));
  const firstDayOfMonth = getDay(new Date(year, month, 1));

  // Calculate the number of rows needed
  const totalDays = firstDayOfMonth + daysInMonth;
  return Math.ceil(totalDays / 7);
};

export function CalendarWidget() {
  // Force the correct date to ensure we're not using a future date
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentDate, setCurrentDate] = useState(today);
  const [view, setView] = useState<CalendarView>("week");

  const [processedEvents, setProcessedEvents] = useState<
    ReturnType<typeof convertGoogleEvent>[]
  >([]);
  const previousDateRange = useRef("");

  const {
    isLoading,
    error,
    events: googleEvents,
    isAuthorized,
    connectToGoogleCalendar,
    refreshEvents,
  } = useGoogleCalendar();

  // Force reset the date if we detect an unreasonable future date (> 1 year from now)
  useEffect(() => {
    const realNow = new Date();
    const oneYearFromNow = addDays(realNow, 365);

    if (
      currentYear > oneYearFromNow.getFullYear() ||
      (currentYear === oneYearFromNow.getFullYear() &&
        currentMonth > oneYearFromNow.getMonth())
    ) {
      setCurrentYear(realNow.getFullYear());
      setCurrentMonth(realNow.getMonth());
      setCurrentDate(realNow);

      // Clear the previous date range to force a refresh
      previousDateRange.current = "";
    }
  }, [currentYear, currentMonth]);

  // Process Google events
  useEffect(() => {
    if (isAuthorized && googleEvents && googleEvents.length > 0) {
      const convertedGoogleEvents = googleEvents.map(convertGoogleEvent);

      // Sort events by start date and then by all-day status (all-day events first)
      convertedGoogleEvents.sort((a, b) => {
        // All-day events come first
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;

        // Then sort by start date
        return a.startDate - b.startDate;
      });

      setProcessedEvents(convertedGoogleEvents);
    } else {
      setProcessedEvents([]);
    }
  }, [googleEvents, isAuthorized]);

  const refreshGoogleCalendarEvents = useCallback(
    async (startTimeStr: string, endTimeStr: string) => {
      if (!isAuthorized) return;

      console.log(
        `Refreshing Google Calendar events from ${startTimeStr} to ${endTimeStr}`
      );
      try {
        await refreshEvents("primary", startTimeStr, endTimeStr);
      } catch (error) {
        console.error("Error refreshing Google Calendar events:", error);
      }
    },
    [isAuthorized, refreshEvents]
  );

  useEffect(() => {
    console.log(
      `Mode: ${view}, Current Year: ${currentYear}, Current Month: ${currentMonth + 1}`
    );

    // Validate the current date parameters to ensure they're reasonable
    const currentDate = new Date();
    const maxAllowedYear = currentDate.getFullYear() + 1; // Allow up to 1 year in the future

    if (currentYear > maxAllowedYear) {
      console.warn(
        `Detected unreasonable year: ${currentYear}, resetting to current year`
      );
      setCurrentYear(currentDate.getFullYear());
      return;
    }

    // Set up the date range based on the current view
    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate =
      view === "month"
        ? new Date(currentYear, currentMonth + 1, 0, 23, 59, 59)
        : add(startDate, { days: 6, hours: 23, minutes: 59, seconds: 59 });

    console.log(
      `Fetching events for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Prevent fetching events if the date range is invalid
    if (
      startDate > endDate ||
      isNaN(startDate.getTime()) ||
      isNaN(endDate.getTime())
    ) {
      console.error("Invalid date range detected, skipping event fetch");
      return;
    }

    // Use previousDateRange to avoid redundant refreshes
    const newDateRangeKey = `${startDate.toISOString()}-${endDate.toISOString()}`;
    if (previousDateRange.current === newDateRangeKey) {
      console.log("Skip refresh - same date range as before");
      return;
    }

    // Store the new date range
    previousDateRange.current = newDateRangeKey;

    // Don't fetch if not authorized
    if (!isAuthorized) {
      return;
    }

    const fetchEvents = async () => {
      const startDate = new Date(currentYear, currentMonth, 1);
      const endDate = new Date(
        currentYear,
        currentMonth + (view === "month" ? 1 : 3),
        0
      );

      // Format to ISO strings
      const startTimeStr = startDate.toISOString();
      const endTimeStr = endDate.toISOString();

      console.log(
        `Fetching events for date range: ${startTimeStr} to ${endTimeStr}`
      );

      try {
        // Refresh Google Calendar events if authorized
        if (isAuthorized) {
          void refreshGoogleCalendarEvents(startTimeStr, endTimeStr);
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    void fetchEvents();
  }, [
    currentYear,
    currentMonth,
    view,
    isAuthorized,
    refreshGoogleCalendarEvents,
  ]);

  // Navigate to previous/next month or week
  const goToPrevious = () => {
    if (view === "month") {
      const newDate = subMonths(new Date(currentYear, currentMonth, 1), 1);
      setCurrentMonth(newDate.getMonth());
      setCurrentYear(newDate.getFullYear());
    } else {
      // Week view
      const newDate = subDays(currentDate, 7);
      setCurrentDate(newDate);
      setCurrentMonth(newDate.getMonth());
      setCurrentYear(newDate.getFullYear());
    }
  };

  const goToNext = () => {
    if (view === "month") {
      const newDate = addMonths(new Date(currentYear, currentMonth, 1), 1);
      setCurrentMonth(newDate.getMonth());
      setCurrentYear(newDate.getFullYear());
    } else {
      // Week view
      const newDate = addDays(currentDate, 7);
      setCurrentDate(newDate);
      setCurrentMonth(newDate.getMonth());
      setCurrentYear(newDate.getFullYear());
    }
  };

  const handleViewChange = (newView: CalendarView) => {
    setView(newView);
    if (newView === "month") {
      // Make sure month and year are set correctly
      setCurrentMonth(currentDate.getMonth());
      setCurrentYear(currentDate.getFullYear());
    }

    // Reset the previous date range to force a refresh with the new view
    previousDateRange.current = "";
  };

  // Generate days for the calendar grid
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(new Date(currentYear, currentMonth, 1));
    const firstDayOfMonth = getDay(new Date(currentYear, currentMonth, 1));

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  };

  // Generate week days
  const generateWeekDays = () => {
    const { start } = getWeekRange(currentDate);
    const days = [];

    // Generate 7 days from the start of the week
    for (let i = 0; i < 7; i++) {
      days.push(addDays(start, i));
    }

    return days;
  };

  // Function to get events for a specific date
  const getEventsForDate = (date: Date) => {
    if (!googleEvents || googleEvents.length === 0) return [];

    console.log(`Checking for events on date: ${date.toISOString()}`);
    const formattedTargetDate = date.toISOString().split("T")[0]; // YYYY-MM-DD

    // Convert Google events to our format for easier handling
    const convertedEvents = googleEvents.map(convertGoogleEvent);

    return convertedEvents.filter((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);

      // Format dates to YYYY-MM-DD for comparison
      const eventStartDate = eventStart.toISOString().split("T")[0];
      const eventEndDate = eventEnd.toISOString().split("T")[0];

      // Check if the target date falls within the event's start and end dates
      return (
        formattedTargetDate >= eventStartDate &&
        formattedTargetDate <= eventEndDate
      );
    });
  };

  // Wrapper function to handle null dates
  const getEventsForDateObject = (date: Date | null) => {
    if (!date) return [];
    return getEventsForDate(date);
  };

  // Generate calendar days
  const calendarDays = generateCalendarDays();
  const weekDays = generateWeekDays();

  // Get the date range for the header display
  const getHeaderDateDisplay = () => {
    if (view === "month") {
      return format(new Date(currentYear, currentMonth, 1), "MMMM yyyy");
    } else {
      const { start, end } = getWeekRange(currentDate);

      if (start.getMonth() === end.getMonth()) {
        return `${format(start, "MMM d")} - ${format(end, "d")}, ${format(end, "yyyy")}`;
      } else {
        return `${format(start, "MMM d")} - ${format(end, "MMM d")}, ${format(end, "yyyy")}`;
      }
    }
  };

  // Handle manual refresh of Google Calendar events
  const handleRefreshGoogleEvents = () => {
    if (isAuthorized) {
      console.log("Manually refreshing Google Calendar events");

      // Force a refresh by clearing the previous date range flag
      previousDateRange.current = "";

      let startDate, endDate;

      if (view === "month") {
        // Start from the beginning of the first week shown in the month view
        const firstOfMonth = new Date(currentYear, currentMonth, 1);
        const firstDayOfMonth = getDay(firstOfMonth);
        startDate = subDays(firstOfMonth, firstDayOfMonth);

        // End at the last day of the calendar grid
        const lastOfMonth = endOfMonth(new Date(currentYear, currentMonth, 1));
        const daysInMonth = getDaysInMonth(
          new Date(currentYear, currentMonth, 1)
        );
        const totalDaysShown = firstDayOfMonth + daysInMonth;
        const weeksNeeded = Math.ceil(totalDaysShown / 7);
        const totalDaysInGrid = weeksNeeded * 7;
        const remainingDays = totalDaysInGrid - totalDaysShown;

        endDate = addDays(lastOfMonth, remainingDays);
      } else {
        const { start, end } = getWeekRange(currentDate);
        startDate = start;
        endDate = end;
      }

      console.log(
        `Manual refresh for: ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Use void to ignore the Promise
      void refreshEvents(
        "primary",
        startDate.toISOString(),
        endDate.toISOString(),
        250, // maxResults
        true // forceRefresh - force refresh from API
      );
    } else {
      console.log("Cannot refresh - not authorized with Google Calendar");
    }
  };

  // Generate calendar rows using current date
  const calendarRows = useMemo(() => {
    const currentDate = new Date();
    console.log(
      `Generating calendar with current date: ${currentDate.toISOString()}`
    );
    return generateCalendarRows(currentMonth, currentYear);
  }, [currentMonth, currentYear]);

  return (
    <div className="bg-card rounded-lg border shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
        <h2 className="text-xl font-medium text-card-foreground">Calendar</h2>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <Tabs
            value={view}
            onValueChange={(v) => handleViewChange(v as CalendarView)}
            className="mr-2"
          >
            <TabsList>
              <TabsTrigger value="month" className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                <span>Month</span>
              </TabsTrigger>
              <TabsTrigger value="week" className="flex items-center gap-1">
                <CalendarRange className="h-4 w-4" />
                <span>Week</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center space-x-2">
            <button
              onClick={goToPrevious}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={view === "month" ? "Previous month" : "Previous week"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <span className="text-sm font-medium">
              {getHeaderDateDisplay()}
            </span>
            <button
              onClick={goToNext}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={view === "month" ? "Next month" : "Next week"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {!isAuthorized && (
        <div className="mb-4 p-3 bg-muted border rounded-md">
          <p className="text-muted-foreground text-sm mb-3">
            Connect to Google Calendar to view your events
          </p>
          <Button
            onClick={() => void connectToGoogleCalendar()}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
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

      {isAuthorized && (
        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="cursor-pointer">
              Google Calendar
              {googleEvents.length > 0 && ` (${googleEvents.length})`}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshGoogleEvents}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
            />
            <span className="text-xs">Refresh</span>
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-2 bg-destructive/10 text-destructive text-sm rounded-md">
          Error: {error.message}
        </div>
      )}

      {isAuthorized && googleEvents.length === 0 && !isLoading && (
        <div className="mb-4 p-2 bg-muted text-muted-foreground text-sm rounded-md">
          No Google Calendar events found for this time period
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        {/* Calendar header */}
        <div className="grid grid-cols-7 bg-muted">
          {DAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Month View */}
        {view === "month" && (
          <div className={`grid grid-cols-7 grid-rows-${calendarRows}`}>
            {calendarDays.map((day, i) => {
              const isCurrentDay =
                day === today.getDate() &&
                currentMonth === today.getMonth() &&
                currentYear === today.getFullYear();

              const eventsForDay =
                day !== null
                  ? getEventsForDate(new Date(currentYear, currentMonth, day))
                  : [];

              // Sort events: all-day first, then by start time
              const sortedEvents = [...eventsForDay].sort((a, b) => {
                if (a.isAllDay && !b.isAllDay) return -1;
                if (!a.isAllDay && b.isAllDay) return 1;
                return a.startDate - b.startDate;
              });

              // Separate all-day events from regular events
              const allDayEvents = sortedEvents.filter(
                (event) => event.isAllDay
              );

              return (
                <div
                  key={i}
                  className={`min-h-[80px] p-1 border ${day === null ? "bg-muted/30" : ""}`}
                >
                  {day !== null && (
                    <div className="h-full">
                      <div
                        className={`flex justify-center items-center w-7 h-7 rounded-full text-xs mb-1 ${isCurrentDay ? "bg-primary text-primary-foreground font-medium" : ""}`}
                      >
                        {day}
                      </div>
                      <div className="space-y-1">
                        {allDayEvents.map((event) => (
                          <div
                            key={`all-day-${event._id}`}
                            className="text-xs px-1 py-0.5 mb-0.5 rounded flex items-center gap-0.5"
                            style={{
                              backgroundColor: `${event.color}20`,
                              color: event.color,
                              borderLeft: `2px solid ${event.color}`,
                            }}
                            title={`${event.title}${event.location ? ` - ${event.location}` : ""}`}
                          >
                            <div className="w-1 h-1 rounded-full bg-current" />
                            <div className="flex-grow truncate">
                              {event.title}
                            </div>
                            <div className="flex-shrink-0 text-[8px]">
                              All day
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Week View */}
        {view === "week" && (
          <div className="grid grid-cols-7">
            {weekDays.map((date, i) => {
              const isCurrentDay = isToday(date);
              const eventsForDay = getEventsForDateObject(date);

              // Sort events: all-day first, then by start time
              const sortedEvents = [...eventsForDay].sort((a, b) => {
                if (a.isAllDay && !b.isAllDay) return -1;
                if (!a.isAllDay && b.isAllDay) return 1;
                return a.startDate - b.startDate;
              });

              // Separate all-day events from regular events
              const allDayEvents = sortedEvents.filter(
                (event) => event.isAllDay
              );
              const timedEvents = sortedEvents.filter(
                (event) => !event.isAllDay
              );

              return (
                <div key={i} className="min-h-[140px] p-1 border">
                  <div className="h-full">
                    <div
                      className={`flex flex-col items-center mb-1 ${isCurrentDay ? "font-medium" : ""}`}
                    >
                      <span className="text-xs text-muted-foreground">
                        {DAYS[i]}
                      </span>
                      <div
                        className={`flex justify-center items-center w-7 h-7 rounded-full text-xs ${isCurrentDay ? "bg-primary text-primary-foreground font-medium" : ""}`}
                      >
                        {date.getDate()}
                      </div>
                    </div>

                    {/* All-day events section */}
                    {allDayEvents.length > 0 && (
                      <div className="mb-1 border-b pb-1">
                        {allDayEvents.map((event) => (
                          <div
                            key={`all-day-${event._id}`}
                            className="text-xs px-1 py-0.5 mb-0.5 rounded flex items-center gap-0.5"
                            style={{
                              backgroundColor: `${event.color}20`,
                              color: event.color,
                              borderLeft: `2px solid ${event.color}`,
                            }}
                            title={`${event.title}${event.location ? ` - ${event.location}` : ""}`}
                          >
                            <div className="w-1 h-1 rounded-full bg-current" />
                            <div className="flex-grow truncate">
                              {event.title}
                            </div>
                            <div className="flex-shrink-0 text-[8px]">
                              All day
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Timed events section */}
                    <div className="space-y-1 overflow-auto max-h-[120px]">
                      {timedEvents.map((event) => {
                        const startTime = format(
                          new Date(event.startDate),
                          "h:mm a"
                        );
                        const duration = differenceInMinutes(
                          new Date(event.endDate),
                          new Date(event.startDate)
                        );

                        const durationText =
                          duration < 60
                            ? `${duration}m`
                            : `${Math.floor(duration / 60)}h${duration % 60 ? ` ${duration % 60}m` : ""}`;

                        return (
                          <div
                            key={`timed-${event._id}`}
                            className="text-xs px-1 py-0.5 rounded"
                            style={{
                              backgroundColor: `${event.color}20`,
                              color: event.color,
                              borderLeft: `2px solid ${event.color}`,
                            }}
                            title={`${event.title} - ${startTime}${event.location ? ` - ${event.location}` : ""}${event.category ? ` - ${event.category}` : ""}`}
                          >
                            <div className="flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-current" />
                              <span className="truncate">{event.title}</span>
                            </div>
                            <div className="text-[10px] flex justify-between">
                              <span>{startTime}</span>
                              <span>{durationText}</span>
                            </div>
                          </div>
                        );
                      })}
                      {sortedEvents.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          No events
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming events */}
      <div className="mt-6">
        <h3 className="text-sm font-medium mb-3">Upcoming Events</h3>
        <div className="space-y-3">
          {processedEvents.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No events yet
            </p>
          ) : (
            processedEvents
              // Filter to only show upcoming events (today and future)
              .filter((event) => {
                const now = new Date().getTime();
                return event.endDate >= now;
              })
              // Sort by start date
              .sort((a, b) => a.startDate - b.startDate)
              .slice(0, 5)
              .map((event) => {
                const startDate = new Date(event.startDate);
                const endDate = new Date(event.endDate);
                const isEventToday = isToday(startDate);
                const isTomorrow = isToday(addDays(startDate, -1));

                // Format the date label based on when event occurs
                let dateLabel = format(startDate, "EEE, MMM d");

                if (isEventToday) {
                  dateLabel = "Today";
                } else if (isTomorrow) {
                  dateLabel = "Tomorrow";
                }

                return (
                  <div
                    key={event._id}
                    className="p-3 border rounded-md flex items-start gap-3"
                    style={{
                      borderLeftWidth: "4px",
                      borderLeftColor: event.color || "#3b82f6",
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: event.color }}
                          />
                          {event.title}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                          {event.category || "Google Calendar"}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center text-xs text-muted-foreground">
                        <span className="font-medium">{dateLabel}</span>
                        <span className="mx-1.5">•</span>
                        {event.isAllDay ? (
                          <span>All day</span>
                        ) : (
                          <span>
                            {format(startDate, "h:mm a")}
                            {" - "}
                            {format(endDate, "h:mm a")}
                          </span>
                        )}
                        {event.location && (
                          <>
                            <span className="mx-1.5">•</span>
                            <span className="truncate max-w-[150px]">
                              {event.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
