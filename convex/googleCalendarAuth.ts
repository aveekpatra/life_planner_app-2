import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
  internalAction,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Environment variables should be set in the Convex dashboard
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:5173/auth/google/callback";

// Save Google Calendar authentication data
export const saveAuthData = internalMutation({
  args: {
    isAuthorized: v.boolean(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    calendarIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Get the user ID using the helper function
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

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
        refreshToken: args.refreshToken
          ? args.refreshToken
          : existingAuth.refreshToken,
        tokenExpiry: args.tokenExpiry,
        calendarIds: args.calendarIds,
        updatedAt: now,
      });
    } else {
      // Create new record
      return await ctx.db.insert("googleCalendarAuth", {
        userId,
        isAuthorized: args.isAuthorized,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiry: args.tokenExpiry,
        calendarIds: args.calendarIds || ["primary"],
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Get auth URL for Google Calendar OAuth flow
export const getAuthUrl = action({
  args: {}, // Explicitly define empty args object
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error("getAuthUrl: User not authenticated");
      throw new Error("Not authenticated");
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error("getAuthUrl: Google client ID not configured");
      throw new Error("Google client ID not configured");
    }

    console.log("getAuthUrl: Using redirect URI:", REDIRECT_URI);

    // State parameter to prevent CSRF
    const state = Math.random().toString(36).substring(2);

    // Scopes for calendar access
    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ];

    // Build the OAuth URL
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.append("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", scopes.join(" "));
    authUrl.searchParams.append("access_type", "offline");
    authUrl.searchParams.append("prompt", "consent"); // Force consent to get a refresh token
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("include_granted_scopes", "true");

    console.log(
      "getAuthUrl: Generated auth URL (partial):",
      authUrl.toString().substring(0, 100) + "..."
    );

    return authUrl.toString();
  },
});

// Internal version of getAuthStatus for other functions to use
export const getAuthStatusInternal = internalQuery({
  handler: async (ctx) => {
    // Get the user ID using the helper function
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { isAuthorized: false };
    }

    const authData = await ctx.db
      .query("googleCalendarAuth")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!authData) {
      return { isAuthorized: false };
    }

    return {
      isAuthorized: authData.isAuthorized,
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      tokenExpiry: authData.tokenExpiry,
      calendarIds: authData.calendarIds || ["primary"],
    };
  },
});

// Helper function to fetch calendar list
async function fetchCalendarList(
  accessToken: string
): Promise<{ items: Array<{ id: string; summary: string }> }> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?showHidden=true&minAccessRole=reader",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch calendars: ${response.statusText}`);
  }

  return response.json();
}

// Exchange auth code for tokens
export const exchangeCodeForTokens = action({
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error("exchangeCodeForTokens: User not authenticated");
      throw new Error("Not authenticated");
    }

    // We don't use identity.subject directly as an ID
    console.log("exchangeCodeForTokens: Processing for authenticated user");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error(
        "exchangeCodeForTokens: Google client credentials not configured"
      );
      throw new Error("Google client credentials not configured");
    }

    console.log(
      "exchangeCodeForTokens: Preparing token exchange with code:",
      args.code.substring(0, 10) + "..."
    );
    console.log("exchangeCodeForTokens: Using redirect URI:", REDIRECT_URI);

    // Exchange code for tokens
    try {
      console.log("exchangeCodeForTokens: Sending token request to Google...");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code: args.code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      console.log(
        "exchangeCodeForTokens: Token response status:",
        tokenResponse.status
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(
          "exchangeCodeForTokens: Token exchange failed:",
          errorText
        );

        let errorData: { error?: string; error_description?: string };
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = {
            error: "Invalid response format",
            error_description: errorText,
          };
        }

        throw new Error(
          `Failed to exchange code for tokens: ${errorData.error_description || errorData.error || "Unknown error"}`
        );
      }

      const tokens: {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      } = await tokenResponse.json();

      console.log(
        "exchangeCodeForTokens: Received tokens, access token length:",
        tokens.access_token ? tokens.access_token.length : 0
      );
      console.log(
        "exchangeCodeForTokens: Refresh token present:",
        !!tokens.refresh_token
      );

      // Calculate token expiry time (tokens.expires_in is in seconds)
      const tokenExpiry = Date.now() + tokens.expires_in * 1000;

      // Save tokens to database
      console.log("exchangeCodeForTokens: Saving tokens to database...");
      await ctx.runMutation(internal.googleCalendarAuth.saveAuthData, {
        isAuthorized: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokenExpiry,
      });

      // Try to fetch user's calendar list
      try {
        console.log("exchangeCodeForTokens: Fetching calendar list...");
        const calendars = await fetchCalendarList(tokens.access_token);
        console.log(
          "exchangeCodeForTokens: Retrieved calendars:",
          calendars.items.length
        );

        // Log calendars for debugging
        console.log(
          "Calendar list:",
          calendars.items.map((cal) => `${cal.id} (${cal.summary})`)
        );

        // Include all calendars the user has at least read access to
        const calendarIds = calendars.items
          .filter(
            (cal: any) =>
              cal.accessRole &&
              ["owner", "writer", "reader"].includes(cal.accessRole)
          )
          .map((cal: { id: string }) => cal.id);

        console.log("Final calendar IDs to save:", calendarIds);

        // Update with calendar IDs
        console.log("exchangeCodeForTokens: Updating with calendar IDs...");
        await ctx.runMutation(internal.googleCalendarAuth.saveAuthData, {
          isAuthorized: true,
          calendarIds: calendarIds,
        });

        return { success: true, calendars: calendars.items };
      } catch (error) {
        console.error(
          "exchangeCodeForTokens: Error fetching calendars:",
          error
        );
        return {
          success: true,
          message: "Authentication successful but error fetching calendars",
        };
      }
    } catch (error) {
      console.error("exchangeCodeForTokens: Overall error:", error);
      throw error;
    }
  },
});

// Internal refresh token function
export const refreshAccessTokenInternal = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    success: boolean;
    accessToken?: string;
    tokenExpiry?: number;
    error?: string;
  }> => {
    // Verify the user is authenticated
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google client credentials not configured");
    }

    // Get the current auth data
    const authData: {
      isAuthorized: boolean;
      refreshToken?: string;
      accessToken?: string;
      tokenExpiry?: number;
    } = await ctx.runQuery(internal.googleCalendarAuth.getAuthStatusInternal);

    if (!authData.isAuthorized || !authData.refreshToken) {
      return { success: false, error: "No refresh token available" };
    }

    // Exchange refresh token for a new access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: authData.refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token refresh failed:", errorData);

      // If refresh token is invalid, mark as unauthorized
      if (errorData.error === "invalid_grant") {
        await ctx.runMutation(internal.googleCalendarAuth.saveAuthData, {
          isAuthorized: false,
          accessToken: undefined,
          tokenExpiry: undefined,
        });
        return {
          success: false,
          error: "Refresh token invalid, reauthorization required",
        };
      }

      throw new Error(
        `Failed to refresh token: ${errorData.error_description || errorData.error || "Unknown error"}`
      );
    }

    const tokens: {
      access_token: string;
      expires_in: number;
    } = await tokenResponse.json();

    // Calculate new expiry time
    const tokenExpiry = Date.now() + tokens.expires_in * 1000;

    // Save the new access token
    await ctx.runMutation(internal.googleCalendarAuth.saveAuthData, {
      isAuthorized: true,
      accessToken: tokens.access_token,
      tokenExpiry: tokenExpiry,
    });

    return {
      success: true,
      accessToken: tokens.access_token,
      tokenExpiry: tokenExpiry,
    };
  },
});

// Public version of refresh token function
export const refreshAccessToken = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    accessToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (
    ctx
  ): Promise<{
    success: boolean;
    accessToken?: string;
    tokenExpiry?: number;
    error?: string;
  }> => {
    return await ctx.runAction(
      internal.googleCalendarAuth.refreshAccessTokenInternal,
      {}
    );
  },
});

// Get Google Calendar access token with automatic refresh if needed
export const getAccessToken = action({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    success: boolean;
    accessToken?: string;
    tokenExpiry?: number;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current auth data
    const authData: {
      isAuthorized: boolean;
      accessToken?: string;
      tokenExpiry?: number;
    } = await ctx.runQuery(internal.googleCalendarAuth.getAuthStatusInternal);

    if (!authData.isAuthorized) {
      return { success: false, error: "Not authorized" };
    }

    // If token is expired or will expire soon (within 5 minutes), refresh it
    if (
      !authData.accessToken ||
      !authData.tokenExpiry ||
      Date.now() > authData.tokenExpiry - 5 * 60 * 1000
    ) {
      console.log("Token expired or will expire soon, refreshing...");
      return await ctx.runAction(
        internal.googleCalendarAuth.refreshAccessTokenInternal
      );
    }

    // Return the current valid token
    return {
      success: true,
      accessToken: authData.accessToken,
      tokenExpiry: authData.tokenExpiry,
    };
  },
});

// Get user's Google Calendar auth status
export const getAuthStatus = query({
  handler: async (ctx) => {
    // Get the user ID using the helper function
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { isAuthorized: false };
    }

    const authData = await ctx.db
      .query("googleCalendarAuth")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!authData) {
      return { isAuthorized: false };
    }

    return {
      isAuthorized: authData.isAuthorized,
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      tokenExpiry: authData.tokenExpiry,
      calendarIds: authData.calendarIds || ["primary"],
    };
  },
});

// Revoke Google Calendar authentication
export const revokeAuth = mutation({
  handler: async (ctx) => {
    // Get the user ID using the helper function
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const authData = await ctx.db
      .query("googleCalendarAuth")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (authData && authData.accessToken) {
      // Try to revoke the token with Google
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${authData.accessToken}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );
      } catch (error) {
        console.error("Error revoking token:", error);
      }
    }

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

// Public action to refresh the user's calendar list
export const refreshCalendarList = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get the current auth data
    const authData = await ctx.runQuery(
      internal.googleCalendarAuth.getAuthStatusInternal
    );

    if (!authData.isAuthorized || !authData.accessToken) {
      return {
        success: false,
        message: "Not authorized with Google Calendar",
      };
    }

    try {
      // Get a fresh access token
      const tokenResult = await ctx.runAction(
        internal.googleCalendarAuth.refreshAccessTokenInternal
      );

      if (!tokenResult.success || !tokenResult.accessToken) {
        return {
          success: false,
          message: "Failed to refresh access token",
        };
      }

      // Fetch the calendar list with the fresh token
      console.log("refreshCalendarList: Fetching calendar list...");
      const calendars = await fetchCalendarList(tokenResult.accessToken);
      console.log(
        "refreshCalendarList: Retrieved calendars:",
        calendars.items.length
      );

      // Log calendars for debugging
      console.log(
        "Calendar list:",
        calendars.items.map(
          (cal: any) => `${cal.id} (${cal.summary}) - access: ${cal.accessRole}`
        )
      );

      // Include all calendars the user has at least read access to
      const calendarIds = calendars.items
        .filter(
          (cal: any) =>
            cal.accessRole &&
            ["owner", "writer", "reader"].includes(cal.accessRole)
        )
        .map((cal: { id: string }) => cal.id);

      console.log("Final calendar IDs to save:", calendarIds);

      // Update calendar IDs in the database
      await ctx.runMutation(internal.googleCalendarAuth.saveAuthData, {
        isAuthorized: true,
        calendarIds: calendarIds,
      });

      return {
        success: true,
        message: `Found ${calendarIds.length} calendars`,
        calendarIds,
      };
    } catch (error: any) {
      console.error("Error refreshing calendar list:", error);
      return {
        success: false,
        message: error.message || "Unknown error refreshing calendar list",
      };
    }
  },
});
