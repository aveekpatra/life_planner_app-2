/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as events from "../events.js";
import type * as googleAuth from "../googleAuth.js";
import type * as googleCalendarAuth from "../googleCalendarAuth.js";
import type * as http from "../http.js";
import type * as notes from "../notes.js";
import type * as projects from "../projects.js";
import type * as tasks from "../tasks.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  events: typeof events;
  googleAuth: typeof googleAuth;
  googleCalendarAuth: typeof googleCalendarAuth;
  http: typeof http;
  notes: typeof notes;
  projects: typeof projects;
  tasks: typeof tasks;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
