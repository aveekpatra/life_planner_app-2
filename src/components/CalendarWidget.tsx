import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { CalendarDays, CalendarRange } from "lucide-react";

// Helper function to create calendar grid
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

// Get start and end date of a week for a given date
const getWeekRange = (date: Date) => {
  const day = date.getDay();
  const diff = date.getDate() - day;
  const start = new Date(date);
  start.setDate(diff);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
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

export function CalendarWidget() {
  const events = useQuery(api.events.list) || [];
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentDate, setCurrentDate] = useState(today);
  const [view, setView] = useState<CalendarView>("month");

  // Navigate to previous/next month or week
  const goToPrevious = () => {
    if (view === "month") {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      // Week view
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 7);
      setCurrentDate(newDate);
      setCurrentMonth(newDate.getMonth());
      setCurrentYear(newDate.getFullYear());
    }
  };

  const goToNext = () => {
    if (view === "month") {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    } else {
      // Week view
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 7);
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
  };

  // Generate days for the calendar grid
  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentYear, currentMonth);

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
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }

    return days;
  };

  const getEventsForDate = (
    day: number | null,
    month = currentMonth,
    year = currentYear
  ) => {
    if (day === null) return [];

    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    });
  };

  const getEventsForDateObject = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
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
      return `${MONTHS[currentMonth]} ${currentYear}`;
    } else {
      const { start, end } = getWeekRange(currentDate);
      const startMonth = MONTHS[start.getMonth()].substring(0, 3);
      const endMonth = MONTHS[end.getMonth()].substring(0, 3);

      if (start.getMonth() === end.getMonth()) {
        return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`;
      } else {
        return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
      }
    }
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
              const isToday =
                day === today.getDate() &&
                currentMonth === today.getMonth() &&
                currentYear === today.getFullYear();

              const eventsForDay = getEventsForDate(day);
              const hasEvents = eventsForDay.length > 0;

              return (
                <div
                  key={i}
                  className={`min-h-[80px] p-1 border ${day === null ? "bg-muted/30" : ""}`}
                >
                  {day !== null && (
                    <div className="h-full">
                      <div
                        className={`flex justify-center items-center w-7 h-7 rounded-full text-xs mb-1 ${isToday ? "bg-primary text-primary-foreground font-medium" : ""}`}
                      >
                        {day}
                      </div>
                      <div className="space-y-1">
                        {eventsForDay.slice(0, 3).map((event) => (
                          <div
                            key={event._id}
                            className="text-xs truncate px-1 py-0.5 rounded"
                            style={{
                              backgroundColor: `${event.color}20`,
                              color: event.color,
                              borderLeft: `2px solid ${event.color}`,
                            }}
                          >
                            {event.title}
                          </div>
                        ))}
                        {eventsForDay.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center">
                            +{eventsForDay.length - 3} more
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
              const isToday =
                date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();

              const eventsForDay = getEventsForDateObject(date);

              return (
                <div key={i} className="min-h-[140px] p-1 border">
                  <div className="h-full">
                    <div
                      className={`flex flex-col items-center mb-1 ${isToday ? "font-medium" : ""}`}
                    >
                      <span className="text-xs text-muted-foreground">
                        {DAYS[i]}
                      </span>
                      <div
                        className={`flex justify-center items-center w-7 h-7 rounded-full text-xs ${isToday ? "bg-primary text-primary-foreground font-medium" : ""}`}
                      >
                        {date.getDate()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {eventsForDay.map((event) => (
                        <div
                          key={event._id}
                          className="text-xs truncate px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: `${event.color}20`,
                            color: event.color,
                            borderLeft: `2px solid ${event.color}`,
                          }}
                        >
                          <div>{event.title}</div>
                          <div className="text-[10px]">
                            {new Date(event.startDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      ))}
                      {eventsForDay.length === 0 && (
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
          {events.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No events yet
            </p>
          ) : (
            events
              .sort((a, b) => a.startDate - b.startDate)
              .slice(0, 5)
              .map((event) => (
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
                      <h4 className="font-medium text-sm">{event.title}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                        {event.category || "other"}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {event.description}
                      </p>
                    )}
                    <div className="mt-1">
                      <div className="text-xs text-muted-foreground">
                        {event.isAllDay ? (
                          <span>
                            All day ·{" "}
                            {new Date(event.startDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span>
                            {new Date(event.startDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            -{" "}
                            {new Date(event.endDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            · {new Date(event.startDate).toLocaleDateString()}
                          </span>
                        )}
                        {event.location && <span> · {event.location}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
