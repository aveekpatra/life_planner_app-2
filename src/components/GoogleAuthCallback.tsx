import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export function GoogleAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get the code and error from URL params
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    // Log them for debugging
    console.log("GoogleAuthCallback: Authorization callback received");
    console.log("Code present:", !!code);
    console.log("Error present:", !!error);

    if (error) {
      console.error("Google auth error:", error);
    }

    // Try to communicate with the opener window
    if (window.opener && !window.opener.closed) {
      try {
        // Attempt to make the code available to the opener window
        // This helps with cross-origin issues that might occur with direct polling
        console.log("Attempting to communicate with opener window");

        // Use postMessage for secure cross-origin communication
        window.opener.postMessage(
          {
            type: "GOOGLE_AUTH_CALLBACK",
            code: code,
            error: error,
          },
          window.location.origin
        );

        console.log("Message posted to opener");

        // Close this window after a short delay to ensure the message is delivered
        setTimeout(() => {
          window.close();
        }, 1000);
      } catch (err) {
        console.error("Error communicating with opener:", err);
      }
    } else {
      console.log("No opener window found or it's closed");
    }

    // Close this window automatically after a delay as a fallback
    const timer = setTimeout(() => {
      console.log("GoogleAuthCallback: Auto-closing after timeout");
      // If we have code and there's no opener, redirect to the home page
      if (code && !window.opener) {
        navigate("/", { state: { authCode: code } });
      } else {
        window.close();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  // Get the query params for display
  const params = new URLSearchParams(location.search);
  const code = params.get("code");
  const error = params.get("error");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-xl font-semibold mb-4">
        Authentication {error ? "Failed" : "Complete"}
      </h1>
      {error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : (
        <p>Authorization successful. You can close this window now.</p>
      )}
      {code && (
        <div className="mt-4 p-2 bg-gray-100 text-xs">
          <p>Code received</p>
        </div>
      )}
    </div>
  );
}
