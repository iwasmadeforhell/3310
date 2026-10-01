export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0a1628",
        color: "#c4dc8c",
        fontFamily: "ui-monospace, monospace",
        padding: 16,
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 48 }}>404</div>
        <p>No signal. This page doesn&apos;t exist.</p>
        <a href="/" style={{ color: "#c4dc8c" }}>
          ← back
        </a>
      </div>
    </main>
  );
}
