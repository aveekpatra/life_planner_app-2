import { useEffect } from "react";

export function GoogleAuthCallbackHandler() {
  useEffect(() => {
    // Extract code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const error = urlParams.get("error");

    if (error) {
      // Send error message to parent window
      window.opener.postMessage({ error }, window.location.origin);
      window.close();
      return;
    }

    if (code) {
      // Send code to parent window
      window.opener.postMessage({ code }, window.location.origin);
      window.close();
    } else {
      // No code found, show error
      console.error("No authorization code found in the URL");
      window.opener.postMessage(
        { error: "No authorization code found" },
        window.location.origin
      );
      window.close();
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-4">
          Google Calendar Authorization
        </h1>
        <p>Completing authentication...</p>
        <p className="text-sm text-muted-foreground mt-2">
          This window will close automatically
        </p>
      </div>
    </div>
  );
}
