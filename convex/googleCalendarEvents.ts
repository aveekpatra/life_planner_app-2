import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Modify schema.ts to include this table
// googleCalendarEvents: defineTable({
//   userId: v.id("users"),
//   googleEventId: v.string(),
//   title: v.string(),
//   description: v.optional(v.string()),
//   startDate: v.number(),
//   endDate: v.number(),
//   location: v.optional(v.string()),
//   isAllDay: v.boolean(),
//   color: v.optional(v.string()),
//   calendarId: v.string(),
//   lastSynced: v.number(),
//   etag: v.optional(v.string()),
//   originalEvent: v.optional(v.object({})), // Store the original event data
// })
//   .index("by_user", ["userId"])
//   .index("by_googleEventId", ["googleEventId"])
//   .index("by_date_range", ["userId", "startDate", "endDate"]),

// Fetch events from Google Calendar and store them in Convex
export const syncEvents = action({
  args: {
    timeMin: v.string(),
    timeMax: v.string(),
    calendarId: v.optional(v.string()),
    maxResults: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    message: string;
    eventCount?: number;
  }> => {
    // Get auth status and access token
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const authStatus = await ctx.runQuery(
      internal.googleCalendarAuth.getAuthStatusInternal
    );
    if (!authStatus.isAuthorized || !authStatus.accessToken) {
      return {
        success: false,
        message: "Not authorized with Google Calendar",
      };
    }

    // If token is expired, refresh it
    let accessToken = authStatus.accessToken;
    if (authStatus.tokenExpiry && authStatus.tokenExpiry < Date.now()) {
      const refreshResult = await ctx.runAction(
        internal.googleCalendarAuth.refreshAccessTokenInternal
      );
      if (!refreshResult.success) {
        return {
          success: false,
          message: "Failed to refresh access token",
        };
      }
      if (!refreshResult.accessToken) {
        return {
          success: false,
          message: "Got successful refresh but no access token",
        };
      }
      accessToken = refreshResult.accessToken;
    }

    const calendarId = args.calendarId || "primary";
    const maxResults = args.maxResults || 250;
    const timeMin = args.timeMin;
    const timeMax = args.timeMax;

    try {
      // 1. Fetch events from Google Calendar API
      console.log(
        `Fetching events from ${timeMin} to ${timeMax} for calendar ${calendarId}`
      );

      const url = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events`
      );

      url.searchParams.append("maxResults", maxResults.toString());
      url.searchParams.append("timeMin", timeMin);
      url.searchParams.append("timeMax", timeMax);
      url.searchParams.append("singleEvents", "true");
      url.searchParams.append("orderBy", "startTime");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error fetching events:", errorText);
        throw new Error(
          `Failed to fetch events: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const events = data.items || [];

      console.log(`Retrieved ${events.length} events from Google Calendar`);

      // 2. Process and store events in Convex
      const syncResults = await ctx.runAction(
        internal.googleCalendarEvents.storeGoogleEvents,
        {
          events,
          userId,
          calendarId,
        }
      );

      return {
        success: true,
        eventCount: syncResults.count,
        message: `Successfully synced ${syncResults.count} events`,
      };
    } catch (error: any) {
      console.error("Error syncing events:", error);
      return {
        success: false,
        message: error.message || "Unknown error syncing events",
      };
    }
  },
});

// Fetch events from all Google Calendars and store them in Convex
export const syncEventsFromAllCalendars = action({
  args: {
    timeMin: v.string(),
    timeMax: v.string(),
    maxResults: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    message: string;
    eventCount?: number;
    calendarsProcessed?: number;
  }> => {
    // Get auth status and access token
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const authStatus = await ctx.runQuery(
      internal.googleCalendarAuth.getAuthStatusInternal
    );
    if (!authStatus.isAuthorized || !authStatus.accessToken) {
      return {
        success: false,
        message: "Not authorized with Google Calendar",
      };
    }

    // Get calendar IDs
    const calendarIds = authStatus.calendarIds || ["primary"];

    // Log all calendar IDs for debugging
    console.log(
      `Syncing events from ${calendarIds.length} calendars:`,
      JSON.stringify(calendarIds)
    );

    if (calendarIds.length === 1 && calendarIds[0] === "primary") {
      console.log(
        "WARNING: Only primary calendar detected. You may need to re-authenticate to get all calendars."
      );
    }

    // If token is expired, refresh it
    let accessToken = authStatus.accessToken;
    if (authStatus.tokenExpiry && authStatus.tokenExpiry < Date.now()) {
      const refreshResult = await ctx.runAction(
        internal.googleCalendarAuth.refreshAccessTokenInternal
      );
      if (!refreshResult.success) {
        return {
          success: false,
          message: "Failed to refresh access token",
        };
      }
      if (!refreshResult.accessToken) {
        return {
          success: false,
          message: "Got successful refresh but no access token",
        };
      }
      accessToken = refreshResult.accessToken;
    }

    const maxResults = args.maxResults || 250;
    const timeMin = args.timeMin;
    const timeMax = args.timeMax;
    let totalEventCount = 0;
    let failedCalendars = 0;
    let processedCalendars: string[] = [];
    let failedCalendarIds: string[] = [];

    // Process each calendar
    for (const calendarId of calendarIds) {
      try {
        // 1. Fetch events from Google Calendar API
        console.log(
          `Fetching events from ${timeMin} to ${timeMax} for calendar ${calendarId}`
        );

        const url = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            calendarId
          )}/events`
        );

        url.searchParams.append("maxResults", maxResults.toString());
        url.searchParams.append("timeMin", timeMin);
        url.searchParams.append("timeMax", timeMax);
        url.searchParams.append("singleEvents", "true");
        url.searchParams.append("orderBy", "startTime");

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Error fetching events for calendar ${calendarId}:`,
            errorText
          );
          failedCalendars++;
          failedCalendarIds.push(calendarId);
          continue; // Skip to the next calendar
        }

        const data = await response.json();
        const events = data.items || [];

        console.log(
          `Retrieved ${events.length} events from calendar ${calendarId}`
        );

        // 2. Process and store events in Convex
        const syncResults = await ctx.runAction(
          internal.googleCalendarEvents.storeGoogleEvents,
          {
            events,
            userId,
            calendarId,
          }
        );

        totalEventCount += syncResults.count;
        processedCalendars.push(calendarId);
      } catch (error: any) {
        console.error(
          `Error syncing events for calendar ${calendarId}:`,
          error
        );
        failedCalendars++;
        failedCalendarIds.push(calendarId);
      }
    }

    if (failedCalendars === calendarIds.length) {
      return {
        success: false,
        message: `Failed to sync events from all calendars: ${failedCalendarIds.join(", ")}`,
      };
    }

    return {
      success: true,
      eventCount: totalEventCount,
      calendarsProcessed: calendarIds.length - failedCalendars,
      message:
        `Successfully synced ${totalEventCount} events from ${processedCalendars.length} calendars (${processedCalendars.join(", ")})` +
        (failedCalendars > 0
          ? ` (Failed calendars: ${failedCalendarIds.join(", ")})`
          : ""),
    };
  },
});

// Internal action to store Google Calendar events in Convex
export const storeGoogleEvents = internalAction({
  args: {
    events: v.array(v.any()),
    userId: v.id("users"),
    calendarId: v.string(),
  },
  handler: async (ctx, args) => {
    let count = 0;

    for (const event of args.events) {
      // Skip events with no summary or that are cancelled
      if (!event.summary || event.status === "cancelled") {
        continue;
      }

      const startDateTime = event.start.dateTime || event.start.date;
      const endDateTime = event.end.dateTime || event.end.date;

      // Skip events with no valid start/end dates
      if (!startDateTime || !endDateTime) {
        continue;
      }

      const isAllDay = !!event.start.date;

      // Generate a default color based on event summary
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

      // Use color from event if available
      let color = defaultColor;
      if (event.colorId) {
        // Google Calendar color IDs mapping
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

      // Convert to Convex event format
      const convexEvent = {
        userId: args.userId,
        googleEventId: event.id,
        title: event.summary,
        description: event.description || "",
        startDate: new Date(startDateTime).getTime(),
        endDate: new Date(endDateTime).getTime(),
        location: event.location || "",
        isAllDay,
        color,
        calendarId: args.calendarId,
        lastSynced: Date.now(),
        etag: event.etag || "",
        originalEvent: event,
      };

      try {
        // Check if event already exists
        const existingEvent = await ctx.runQuery(
          internal.googleCalendarEvents.getByGoogleEventId,
          { googleEventId: event.id }
        );

        if (existingEvent) {
          // Update if etag is different (event has changed)
          if (existingEvent.etag !== event.etag) {
            await ctx.runMutation(
              internal.googleCalendarEvents.updateGoogleEvent,
              {
                eventId: existingEvent._id,
                event: convexEvent,
              }
            );
          }
        } else {
          // Insert new event
          await ctx.runMutation(
            internal.googleCalendarEvents.createGoogleEvent,
            { event: convexEvent }
          );
        }
        count++;
      } catch (error) {
        console.error(`Error storing event ${event.id}:`, error);
      }
    }

    return { count };
  },
});

// Internal query to find an event by Google Event ID
export const getByGoogleEventId = internalQuery({
  args: {
    googleEventId: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"googleCalendarEvents"> | null> => {
    return await ctx.db
      .query("googleCalendarEvents")
      .withIndex("by_googleEventId", (q) =>
        q.eq("googleEventId", args.googleEventId)
      )
      .unique();
  },
});

// Internal mutation to create a new Google Calendar event
export const createGoogleEvent = internalMutation({
  args: {
    event: v.object({
      userId: v.id("users"),
      googleEventId: v.string(),
      title: v.string(),
      description: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      location: v.string(),
      isAllDay: v.boolean(),
      color: v.string(),
      calendarId: v.string(),
      lastSynced: v.number(),
      etag: v.string(),
      originalEvent: v.any(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("googleCalendarEvents", args.event);
  },
});

// Internal mutation to update an existing Google Calendar event
export const updateGoogleEvent = internalMutation({
  args: {
    eventId: v.id("googleCalendarEvents"),
    event: v.object({
      userId: v.id("users"),
      googleEventId: v.string(),
      title: v.string(),
      description: v.string(),
      startDate: v.number(),
      endDate: v.number(),
      location: v.string(),
      isAllDay: v.boolean(),
      color: v.string(),
      calendarId: v.string(),
      lastSynced: v.number(),
      etag: v.string(),
      originalEvent: v.any(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.replace(args.eventId, args.event);
  },
});

// Query to get Google Calendar events for a specific date range
export const getGoogleEvents = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args): Promise<Doc<"googleCalendarEvents">[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Fix the query issue with the index
    // First, we get events that start in the range
    const eventsStartingInRange = await ctx.db
      .query("googleCalendarEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.gte(q.field("startDate"), args.startDate),
          q.lte(q.field("startDate"), args.endDate)
        )
      )
      .collect();

    // Then we get events that end in the range
    const eventsEndingInRange = await ctx.db
      .query("googleCalendarEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.gte(q.field("endDate"), args.startDate),
          q.lte(q.field("endDate"), args.endDate)
        )
      )
      .collect();

    // Combine and deduplicate
    const allEvents = [...eventsStartingInRange];
    for (const event of eventsEndingInRange) {
      if (!allEvents.some((e) => e._id === event._id)) {
        allEvents.push(event);
      }
    }

    return allEvents;
  },
});

// Clear all Google Calendar events for current user (useful for testing or resetting)
export const clearAllEvents = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const events = await ctx.db
      .query("googleCalendarEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    return { deletedCount: events.length };
  },
});

// Schedule periodic sync of calendar events (e.g., once per day)
// Note: Add this to your scheduled tasks in convex/crons.ts
// export const syncGoogleEvents = internalAction({
//   args: {},
//   handler: async (ctx) => {
//     const users = await ctx.runQuery(internal.auth.listUsers);
//     let totalSynced = 0;
//
//     for (const user of users) {
//       try {
//         // Define time range (e.g., next 30 days)
//         const now = new Date();
//         const thirtyDaysLater = new Date();
//         thirtyDaysLater.setDate(now.getDate() + 30);
//
//         const result = await ctx.runAction(internal.googleCalendarEvents.syncEvents, {
//           userId: user._id,
//           timeMin: now.toISOString(),
//           timeMax: thirtyDaysLater.toISOString(),
//         });
//
//         if (result.success) {
//           totalSynced += result.eventCount || 0;
//         }
//       } catch (error) {
//         console.error(`Error syncing events for user ${user._id}:`, error);
//       }
//     }
//
//     return { synced: totalSynced };
//   },
// });
