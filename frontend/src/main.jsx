import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.jsx";
import "./index.css";

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function Root() {
  if (!CLERK_KEY) {
    // Allow the app to run without auth in dev if the key isn't set
    return <App />;
  }
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <App />
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
