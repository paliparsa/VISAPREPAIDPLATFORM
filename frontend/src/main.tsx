import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
function App() {
  return <main className="shell">
    <div className="eyebrow">INDEPENDENT VIRTUAL CARD PLATFORM</div>
    <h1>Visa Prepaid</h1>
    <p className="muted">A secure storefront for provider-approved eligible customers.</p>
    <section className="panel">
      <div className="card-art"><span>VISA</span><small>PREPAID</small></div>
      <h2>Virtual prepaid cards</h2>
      <p className="muted">Products appear after provider availability and customer eligibility are confirmed.</p>
      <span className="status">Sandbox / setup mode</span>
    </section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);