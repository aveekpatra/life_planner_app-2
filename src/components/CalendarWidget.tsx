import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

// Helper function to create calendar grid
const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
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

export function CalendarWidget() {
  const events = useQuery(api.events.list) || [];
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Navigate to previous/next month
  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
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

  const getEventsForDate = (day: number | null) => {
    if (day === null) return [];

    return events.filter((event) => {
      const eventDate = new Date(event.startDate);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === currentMonth &&
        eventDate.getFullYear() === currentYear
      );
    });
  };

  // Generate calendar days
  const calendarDays = generateCalendarDays();

  // Determine the number of rows needed (either 5 or 6 weeks)
  const calendarRows = Math.ceil(calendarDays.length / 7);

  return (
    <div className="bg-card rounded-lg border shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-medium text-card-foreground">Calendar</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={goToPreviousMonth}
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
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
            {MONTHS[currentMonth]} {currentYear}
          </span>
          <button
            onClick={goToNextMonth}
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next month"
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

        {/* Calendar grid */}
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
                      </div>
                      {event.location && (
                        <div className="text-xs text-muted-foreground mt-1">
                          📍 {event.location}
                        </div>
                      )}
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
