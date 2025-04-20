import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const applicationTables = {
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    completed: v.boolean(),
    priority: v.optional(v.string()), // "low", "medium", "high"
    status: v.optional(v.string()), // "todo", "in_progress", "done"
    tags: v.optional(v.array(v.string())),
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    reminderDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  projects: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    completed: v.boolean(),
    status: v.optional(v.string()), // "planning", "active", "on_hold", "completed"
    priority: v.optional(v.string()), // "low", "medium", "high"
    tags: v.optional(v.array(v.string())),
    category: v.optional(v.string()), // "work", "personal", "education", etc.
    progress: v.optional(v.number()), // 0-100
    userId: v.id("users"),
    startDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  events: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    location: v.optional(v.string()),
    category: v.optional(v.string()), // "meeting", "appointment", "reminder", etc.
    isAllDay: v.boolean(),
    isRecurring: v.boolean(),
    recurrenceRule: v.optional(v.string()), // "daily", "weekly", "monthly", "yearly"
    attendees: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    color: v.optional(v.string()), // for calendar display
    userId: v.id("users"),
    reminderTime: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  notes: defineTable({
    title: v.string(),
    content: v.string(),
    category: v.optional(v.string()), // "work", "personal", "ideas", etc.
    tags: v.optional(v.array(v.string())),
    isPinned: v.optional(v.boolean()),
    color: v.optional(v.string()), // for note display
    lastModified: v.number(),
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
  })
    .index("by_user", ["userId"])
    .index("by_pinned", ["userId", "isPinned"]),

  bookmarks: defineTable({
    title: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()), // "work", "research", "reading", etc.
    tags: v.optional(v.array(v.string())),
    favicon: v.optional(v.string()),
    isArchived: v.optional(v.boolean()),
    lastVisited: v.optional(v.number()),
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
  }).index("by_user", ["userId"]),

  googleCalendarAuth: defineTable({
    userId: v.id("users"),
    isAuthorized: v.boolean(),
    accessToken: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    refreshToken: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
