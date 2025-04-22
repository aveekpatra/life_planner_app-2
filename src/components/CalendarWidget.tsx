import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { CalendarDays, CalendarRange, RefreshCw } from "lucide-react";
import { useGoogleCalendar } from "../hooks/useGoogleCalendar";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { GoogleCalendarEvent } from "../services/GoogleCalendarService";
import { Doc, Id } from "../../convex/_generated/dataModel";
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
  isSameDay,
  isToday,
  isFuture,
  differenceInMinutes,
  startOfMonth,
  endOfMonth,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "date-fns";

// Helper function to get start and end date of a week for a given date
const getWeekRange = (date: Date) => {
  const start = startOfWeek(date, { weekStartsOn: 0 }); // Sunday as first day of week
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return { start, end };
};

// Day names for header
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
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

type CalendarView = "month" | "week";

// Define a unified event type that works for both local and Google events
interface CalendarEventBase {
  _id: string;
  title: string;
  description?: string;
  startDate: number;
  endDate: number;
  location?: string;
  category?: string;
  isAllDay?: boolean;
  color?: string;
  source: "local" | "google";
}

// Convert Google Calendar event to our unified format
const convertGoogleEvent = (event: GoogleCalendarEvent): CalendarEventBase => {
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

  // Extract calendar name if available
  const calendarName = (event as any).calendarTitle || "Google Calendar";

  return {
    _id: event.id,
    title: event.summary,
    description: event.description || "",
    startDate: new Date(startDateTime).getTime(),
    endDate: new Date(endDateTime).getTime(),
    location: event.location || "",
    isAllDay: !event.start.dateTime,
    color: color,
    category: calendarName,
    source: "google",
  };
};

// Convert local event to our unified format
const convertLocalEvent = (event: Doc<"events">): CalendarEventBase => {
  return {
    _id: event._id as unknown as string, // Convert ID to string for unified handling
    title: event.title,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    location: event.location,
    category: event.category,
    isAllDay: event.isAllDay,
    color: event.color,
    source: "local",
  };
};

export function CalendarWidget() {
  const localEventsData = useQuery(api.events.list) || [];

  // Debug the current date
  const realToday = new Date();
  // console.log(`Real today's date: ${realToday.toISOString()}`);
  // console.log(`Current year should be: ${realToday.getFullYear()}`);
  // console.log(`Current month should be: ${realToday.getMonth()}`);

  // Force the correct date to ensure we're not using a future date
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentDate, setCurrentDate] = useState(today);

  // Log the initialized state to debug
  // console.log(
  //   `CalendarWidget initialized with year: ${currentYear}, month: ${currentMonth}`
  // );

  const [view, setView] = useState<CalendarView>("week");
  const [mergedEvents, setMergedEvents] = useState<CalendarEventBase[]>([]);
  const [showGoogleEvents, setShowGoogleEvents] = useState(true);
  const eventsInitialized = useRef(false);
  const lastFetchedMonth = useRef<string>("");

  const {
    isLoading,
    error,
    events: googleEvents,
    isAuthorized,
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
      // console.log(
      //   `Correcting unreasonable future date: ${currentYear}-${currentMonth + 1} to ${realNow.getFullYear()}-${realNow.getMonth() + 1}`
      // );
      setCurrentYear(realNow.getFullYear());
      setCurrentMonth(realNow.getMonth());
      setCurrentDate(realNow);

      // Clear the last fetched month to force a refresh
      lastFetchedMonth.current = "";
    }
  }, [currentYear, currentMonth]);

  // Merge events from both sources
  useEffect(() => {
    let allEvents: CalendarEventBase[] = localEventsData.map(convertLocalEvent);

    if (isAuthorized && showGoogleEvents) {
      // console.log(
      //   `Google Calendar events available: ${googleEvents ? googleEvents.length : "none"}`
      // );

      if (googleEvents && googleEvents.length > 0) {
        // console.log(
        //   `Merging ${googleEvents.length} Google events with ${allEvents.length} local events`
        // );
        const convertedGoogleEvents = googleEvents.map(convertGoogleEvent);
        allEvents = [...allEvents, ...convertedGoogleEvents];

        // Sort events by start date and then by all-day status (all-day events first)
        allEvents.sort((a, b) => {
          // All-day events come first
          if (a.isAllDay && !b.isAllDay) return -1;
          if (!a.isAllDay && b.isAllDay) return 1;

          // Then sort by start date
          return a.startDate - b.startDate;
        });
      } else {
        // console.log("No Google Calendar events to merge");
      }
    }

    // console.log(`Total merged events: ${allEvents.length}`);
    setMergedEvents(allEvents);
  }, [localEventsData, googleEvents, isAuthorized, showGoogleEvents]);

  // Function to get date range key for the current view
  const getDateRangeKey = useCallback(() => {
    if (view === "month") {
      return `${currentYear}-${currentMonth}`;
    } else {
      const { start } = getWeekRange(currentDate);
      return `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    }
  }, [view, currentYear, currentMonth, currentDate]);

  // Initial events load when authorized
  useEffect(() => {
    if (isAuthorized && !eventsInitialized.current && !isLoading) {
      eventsInitialized.current = true;
      // console.log("Initial load of Google Calendar events");

      const start = startOfMonth(new Date(currentYear, currentMonth, 1));
      const end = endOfMonth(new Date(currentYear, currentMonth, 1));

      // console.log(
      //   `[Initial Load] Fetching for: ${start.toISOString()} to ${end.toISOString()}`
      // );

      // Clear any previous fetch key to force a refresh
      lastFetchedMonth.current = "";

      // Use void to ignore the Promise - only use required parameters
      void refreshEvents("primary", start.toISOString(), end.toISOString());
    }
  }, [isAuthorized, isLoading, refreshEvents, currentYear, currentMonth]);

  // Fetch Google Calendar events when authorized or when date range changes
  useEffect(() => {
    if (isAuthorized) {
      const currentDateRange = getDateRangeKey();

      // console.log(
      //   `Current date range key: ${currentDateRange} (Year: ${currentYear}, Month: ${currentMonth})`
      // );

      // Only fetch if we haven't fetched this date range yet
      if (currentDateRange !== lastFetchedMonth.current) {
        // console.log(`Fetching events for new date range: ${currentDateRange}`);
        lastFetchedMonth.current = currentDateRange;

        let startDate, endDate;

        if (view === "month") {
          // Start from the beginning of the first week shown in the month view
          // This ensures we get events that start in the previous month but show in the current month view
          const firstOfMonth = new Date(currentYear, currentMonth, 1);
          const firstDayOfMonth = getDay(firstOfMonth);
          startDate = subDays(firstOfMonth, firstDayOfMonth);

          // End at the last day of the calendar grid
          const lastOfMonth = endOfMonth(
            new Date(currentYear, currentMonth, 1)
          );
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

        // console.log(
        //   `[Date Range Change] Fetching for: ${format(startDate, "yyyy-MM-dd")} to ${format(endDate, "yyyy-MM-dd")}`
        // );

        // Use void to ignore the Promise - only use required parameters
        void refreshEvents(
          "primary",
          startDate.toISOString(),
          endDate.toISOString()
        );
      }
    }
  }, [
    isAuthorized,
    getDateRangeKey,
    refreshEvents,
    view,
    currentYear,
    currentMonth,
    currentDate,
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

    // Reset the last fetched month to force a refresh with the new view
    lastFetchedMonth.current = "";
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

  const getEventsForDate = (
    day: number | null,
    month = currentMonth,
    year = currentYear
  ) => {
    if (day === null) return [];

    const targetDate = new Date(year, month, day);
    const targetDateStart = setHours(
      setMinutes(setSeconds(setMilliseconds(targetDate, 0), 0), 0),
      0
    );
    const targetDateEnd = setHours(
      setMinutes(setSeconds(setMilliseconds(targetDate, 999), 59), 59),
      23
    );

    const targetStartTime = targetDateStart.getTime();
    const targetEndTime = targetDateEnd.getTime();

    return mergedEvents.filter((event) => {
      // For all-day events or events that span multiple days
      if (event.isAllDay) {
        // Check if target date falls within the event's timeframe
        return (
          event.startDate <= targetEndTime && event.endDate >= targetStartTime
        );
      }

      // For regular timed events on this day
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    });
  };

  const getEventsForDateObject = (date: Date) => {
    const targetDateStart = setHours(
      setMinutes(setSeconds(setMilliseconds(date, 0), 0), 0),
      0
    );
    const targetDateEnd = setHours(
      setMinutes(setSeconds(setMilliseconds(date, 999), 59), 59),
      23
    );

    const targetStartTime = targetDateStart.getTime();
    const targetEndTime = targetDateEnd.getTime();

    return mergedEvents.filter((event) => {
      // For all-day events or events that span multiple days
      if (event.isAllDay) {
        // Check if target date falls within the event's timeframe
        return (
          event.startDate <= targetEndTime && event.endDate >= targetStartTime
        );
      }

      // For regular timed events
      const eventDate = new Date(event.startDate);
      return isSameDay(eventDate, date);
    });
  };

  // Generate calendar days
  const calendarDays = generateCalendarDays();
  const weekDays = generateWeekDays();

  // Determine the number of rows needed (either 5 or 6 weeks)
  const calendarRows = Math.ceil(calendarDays.length / 7);

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

      // Force a refresh by clearing the last fetched flag
      lastFetchedMonth.current = "";

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

  // Toggle Google Calendar events visibility
  const toggleGoogleEvents = () => {
    setShowGoogleEvents(!showGoogleEvents);
  };

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

      {isAuthorized && (
        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Badge
              variant={showGoogleEvents ? "default" : "outline"}
              className="cursor-pointer"
              onClick={toggleGoogleEvents}
            >
              Google Calendar
              {showGoogleEvents &&
                googleEvents.length > 0 &&
                ` (${googleEvents.length})`}
            </Badge>
            <Badge variant="secondary">
              Local Events
              {localEventsData.length > 0 && ` (${localEventsData.length})`}
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
          <div className="grid grid-cols-7 grid-rows-{calendarRows}">
            {calendarDays.map((day, i) => {
              const isCurrentDay =
                day === today.getDate() &&
                currentMonth === today.getMonth() &&
                currentYear === today.getFullYear();

              const eventsForDay = day !== null ? getEventsForDate(day) : [];
              const hasEvents = eventsForDay.length > 0;

              // Sort events: all-day first, then by start time
              const sortedEvents = [...eventsForDay].sort((a, b) => {
                if (a.isAllDay && !b.isAllDay) return -1;
                if (!a.isAllDay && b.isAllDay) return 1;
                return a.startDate - b.startDate;
              });

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
                        {sortedEvents.slice(0, 3).map((event) => {
                          // Format the start time if not all-day
                          const timeLabel = event.isAllDay
                            ? "All day"
                            : format(new Date(event.startDate), "h:mm a");

                          return (
                            <div
                              key={event._id}
                              className="text-xs truncate px-1 py-0.5 rounded flex items-center gap-1"
                              style={{
                                backgroundColor: `${event.color}20`,
                                color: event.color,
                                borderLeft: `2px solid ${event.color}`,
                              }}
                              title={`${event.title} - ${timeLabel}${event.location ? ` - ${event.location}` : ""}${event.category ? ` - ${event.category}` : ""}`}
                            >
                              {event.source === "google" && (
                                <div className="w-1 h-1 rounded-full bg-current" />
                              )}
                              <span className="truncate">{event.title}</span>
                            </div>
                          );
                        })}
                        {sortedEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{sortedEvents.length - 3} more
                          </div>
                        )}
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
                            {event.source === "google" && (
                              <div className="w-1 h-1 rounded-full bg-current" />
                            )}
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
                              {event.source === "google" && (
                                <div className="w-1 h-1 rounded-full bg-current" />
                              )}
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
          {mergedEvents.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No events yet
            </p>
          ) : (
            mergedEvents
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
                          {event.source === "google" && (
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: event.color }}
                            />
                          )}
                          {event.title}
                        </h4>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                          {event.category ||
                            (event.source === "google" ? "Google" : "other")}
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
