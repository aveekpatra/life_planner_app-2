import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Create a simplified type matching the events schema for better TypeScript support
type Event = {
  _id: string;
  title: string;
  startDate: number;
  endDate: number;
  description?: string;
  location?: string;
  category?: string;
  isAllDay: boolean;
  color?: string;
};

// Date utility functions to replace date-fns
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

export function CalendarTimeline({ onClose }: { onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const events = useQuery(api.events.list) || [];

  // Navigate to previous/next day
  const goToPreviousDay = () => {
    setSelectedDate((prev) => subDays(prev, 1));
  };

  const goToNextDay = () => {
    setSelectedDate((prev) => addDays(prev, 1));
  };

  // Filter events for the selected day
  const dayEvents = events.filter((event) => {
    // Convert database timestamp (milliseconds) to Date object
    const eventStart = new Date(event.startDate);
    const eventEnd = new Date(event.endDate);

    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    // Check if event falls within the selected day
    return (
      (eventStart >= dayStart && eventStart <= dayEnd) || // Event starts on the selected day
      (eventEnd >= dayStart && eventEnd <= dayEnd) || // Event ends on the selected day
      (eventStart <= dayStart && eventEnd >= dayEnd) // Event spans over the selected day
    );
  });

  // Sort events by start time
  const sortedEvents = [...dayEvents].sort((a, b) => a.startDate - b.startDate);

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

  return (
    <div className="w-96 border-l border-border h-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="text-lg font-medium">Schedule</h3>
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
          onClick={goToPreviousDay}
          className="inline-flex items-center justify-center p-1 text-muted-foreground hover:text-foreground"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h4 className="text-sm font-medium">{formatDate(selectedDate)}</h4>
        <button
          onClick={goToNextDay}
          className="inline-flex items-center justify-center p-1 text-muted-foreground hover:text-foreground"
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-4">
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
              // Skip all-day events for timeline view or events that start before our timeline begins
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
                      className="font-medium text-xs truncate"
                      style={{ color: eventColor }}
                    >
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
                      className="font-medium text-xs"
                      style={{ color: getEventColor(event) }}
                    >
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

        {sortedEvents.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No events scheduled for this day
          </div>
        )}
      </div>
    </div>
  );
}
