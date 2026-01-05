import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import client from "./src/lib/apolloClient";
import "./index.css";
import { ApolloProvider } from "@apollo/client/react";
import ErrorMonitor from "./src/lib/ErrorMonitor";

const rootElement = document.getElementById("root")!;
// Init Sentry
ErrorMonitor.init();
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
