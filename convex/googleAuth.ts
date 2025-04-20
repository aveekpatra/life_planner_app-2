import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Save the Google Calendar authentication status for a user
export const saveGoogleCalendarAuth = mutation({
  args: {
    userId: v.id("users"),
    isAuthorized: v.boolean(),
    accessToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // First check if there's an existing record for this user
    const existingAuth = await ctx.db
      .query("googleCalendarAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existingAuth) {
      // Update existing record
      return await ctx.db.patch(existingAuth._id, {
        isAuthorized: args.isAuthorized,
        accessToken: args.accessToken,
        tokenExpiry: args.tokenExpiry,
        refreshToken: args.refreshToken,
        updatedAt: Date.now(),
      });
    } else {
      // Create new record
      return await ctx.db.insert("googleCalendarAuth", {
        userId: args.userId,
        isAuthorized: args.isAuthorized,
        accessToken: args.accessToken,
        tokenExpiry: args.tokenExpiry,
        refreshToken: args.refreshToken,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Get Google Calendar auth status for a user
export const getGoogleCalendarAuth = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleCalendarAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});
