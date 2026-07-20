export const CONSOLE_HEIGHT = 150;

export interface LogEntry { level: string; text: string }

/**
 * Presentational console output list. Fills its parent; caller controls sizing.
 * All colors come from Starlight tokens (via .rcp-console-out) so it inverts
 * with the site theme instead of pinning a near-black that breaks light mode.
 */
export default function ConsoleStrip({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="rcp-console-out">
      {logs.length === 0 ? (
        <div className="rcp-console-empty">// console output appears here. Press Play to run.</div>
      ) : (
        logs.map((l, i) => (
          <div
            key={i}
            className={`rcp-log${l.level === 'error' ? ' rcp-log-error' : l.level === 'warn' ? ' rcp-log-warn' : ''}`}
          >
            {l.text}
          </div>
        ))
      )}
    </div>
  );
}
