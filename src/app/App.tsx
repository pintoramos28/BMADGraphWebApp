const shellFeatures = [
  'Vite 8 + React 19.2 hosted shell baseline',
  'Contract-first schema modules for workspace, worker, and API boundaries',
  'Vitest-backed validation fixtures for canonical payloads',
];

export function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: 'clamp(1.5rem, 2vw, 2.5rem)',
        background:
          'radial-gradient(circle at top left, rgba(227, 177, 104, 0.18), transparent 32%), linear-gradient(180deg, #f4efe7 0%, #dee7eb 100%)',
        color: '#1f2a36',
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          margin: '0 auto',
          maxWidth: '64rem',
          padding: 'clamp(1.5rem, 2vw, 2.5rem)',
          borderRadius: '1.5rem',
          background: 'rgba(255, 255, 255, 0.82)',
          border: '1px solid rgba(31, 42, 54, 0.12)',
          boxShadow: '0 24px 80px rgba(31, 42, 54, 0.12)',
        }}
      >
        <p
          style={{
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#6f5b45',
          }}
        >
          Hosted Shell Baseline
        </p>
        <h1
          style={{
            margin: '0.75rem 0 1rem',
            fontSize: 'clamp(2.25rem, 5vw, 4rem)',
            lineHeight: 1,
          }}
        >
          BMADGraphWebApp
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: '42rem',
            fontSize: '1.05rem',
            lineHeight: 1.65,
          }}
        >
          The shell is intentionally thin. Route policy, service-worker ownership, and graph-runtime benchmarking
          stay deferred to later Epic 1 stories so this baseline can focus on stable contracts and repeatable tooling.
        </p>

        <ul
          style={{
            display: 'grid',
            gap: '0.9rem',
            listStyle: 'none',
            margin: '2rem 0 0',
            padding: 0,
          }}
        >
          {shellFeatures.map((feature) => (
            <li
              key={feature}
              style={{
                padding: '1rem 1.2rem',
                borderRadius: '1rem',
                background: 'rgba(216, 225, 232, 0.45)',
                border: '1px solid rgba(31, 42, 54, 0.08)',
              }}
            >
              {feature}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
