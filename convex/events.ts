import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("events")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    location: v.optional(v.string()),
    category: v.string(),
    isAllDay: v.boolean(),
    isRecurring: v.boolean(),
    recurrenceRule: v.optional(v.string()),
    attendees: v.optional(v.array(v.string())),
    tags: v.array(v.string()),
    color: v.string(),
    reminderTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("events", {
      ...args,
      userId,
    });
  },
});
