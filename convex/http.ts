import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";

const http = httpRouter();

auth.addHttpRoutes(http);

// Debug endpoint to test connectivity
http.route({
  path: "/debug",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const env = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "Set" : "Not set",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
        ? "Set"
        : "Not set",
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || "Using default",
    };

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Debug endpoint is working",
        timestamp: new Date().toISOString(),
        environment: env,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }),
});

export default http;
