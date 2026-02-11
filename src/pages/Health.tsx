const Health = () => (
  <div style={{ padding: 40, fontFamily: "sans-serif" }}>
    <h1>OK - app loaded</h1>
    <p>Safe boot mode active. No auth, no database, no redirects.</p>
    <a href="/auth" style={{ color: "blue", textDecoration: "underline" }}>Go to Login</a>
  </div>
);

export default Health;
