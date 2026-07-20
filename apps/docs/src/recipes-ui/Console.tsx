import ConsoleStrip, { type LogEntry } from './ConsoleStrip';

export default function Console({
  height, logs, onPlay, onReset,
}: { height: number; logs: LogEntry[]; onPlay: () => void; onReset: () => void }) {
  return (
    <div className="rcp-console" style={{ height }}>
      <div className="rcp-console-head">
        <span className="rcp-caption">Console</span>
        <div className="rcp-actions">
          <button type="button" className="rcp-btn rcp-btn-primary" onClick={onPlay} title="Run (Play)">
            <span aria-hidden="true">&#9654;</span> Play
          </button>
          <button type="button" className="rcp-btn rcp-btn-secondary" onClick={onReset} title="Restore original files">
            <span aria-hidden="true">&#8635;</span> Reset
          </button>
        </div>
      </div>
      <div className="rcp-console-body">
        <ConsoleStrip logs={logs} />
      </div>
    </div>
  );
}
