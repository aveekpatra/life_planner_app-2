import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    priority: v.string(),
    status: v.string(),
    tags: v.array(v.string()),
    category: v.string(),
    progress: v.number(),
    startDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("projects", {
      ...args,
      userId,
      completed: false,
      completedAt: undefined,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("projects"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.id);
    if (!project || project.userId !== userId) throw new Error("Project not found");

    await ctx.db.patch(args.id, {
      status: args.status,
      completed: args.status === "completed",
      completedAt: args.status === "completed" ? Date.now() : undefined,
    });
  },
});
