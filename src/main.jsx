import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById("static-splash");
    if (splash) {
      splash.classList.add("done");
      setTimeout(() => splash.remove(), 550);
    }
  });
});