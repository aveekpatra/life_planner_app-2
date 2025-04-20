import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Save Google Calendar authentication data
export const saveAuthData = mutation({
  args: {
    isAuthorized: v.boolean(),
    accessToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject as Id<"users">;

    const now = Date.now();

    // Check if auth record already exists
    const existingAuth = await ctx.db
      .query("googleCalendarAuth")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existingAuth) {
      // Update existing record
      return await ctx.db.patch(existingAuth._id, {
        isAuthorized: args.isAuthorized,
        accessToken: args.accessToken,
        tokenExpiry: args.tokenExpiry,
        refreshToken: args.refreshToken,
        updatedAt: now,
      });
    } else {
      // Create new record
      return await ctx.db.insert("googleCalendarAuth", {
        userId,
        isAuthorized: args.isAuthorized,
        accessToken: args.accessToken,
        tokenExpiry: args.tokenExpiry,
        refreshToken: args.refreshToken,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Get user's Google Calendar auth status
export const getAuthStatus = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { isAuthorized: false };
    }
    const userId = identity.subject as Id<"users">;

    const authData = await ctx.db
      .query("googleCalendarAuth")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!authData) {
      return { isAuthorized: false };
    }

    return {
      isAuthorized: authData.isAuthorized,
      tokenExpiry: authData.tokenExpiry,
    };
  },
});

// Revoke Google Calendar authentication
export const revokeAuth = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const userId = identity.subject as Id<"users">;

    const authData = await ctx.db
      .query("googleCalendarAuth")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (authData) {
      return await ctx.db.patch(authData._id, {
        isAuthorized: false,
        accessToken: undefined,
        tokenExpiry: undefined,
        updatedAt: Date.now(),
      });
    }
  },
});
