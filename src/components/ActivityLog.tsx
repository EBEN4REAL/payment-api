import { useSyncExternalStore } from 'react'
import { activityLog } from '../api'

function statusClass(status: number | null) {
  if (status === null) return 'status neutral'
  if (status < 300) return 'status ok'
  if (status < 500) return 'status warn'
  return 'status bad'
}

export default function ActivityLog() {
  const entries = useSyncExternalStore(activityLog.subscribe, activityLog.getSnapshot)

  return (
    <aside className="log">
      <div className="card-header">
        <h2>Activity</h2>
        <button type="button" onClick={activityLog.clear} disabled={entries.length === 0}>
          Clear
        </button>
      </div>
      <p className="hint">Every API call, newest first. Passwords and tokens are shortened.</p>

      {entries.length === 0 && <p className="muted">No requests yet.</p>}

      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            <details>
              <summary>
                <span className={statusClass(entry.status)}>{entry.status ?? '—'}</span>
                <span className="method">{entry.method}</span>
                <span className="path">{entry.path}</span>
                <span className="time">{entry.durationMs} ms</span>
              </summary>
              <div className="entry-body">
                <p className="muted">{entry.time.toLocaleTimeString()}</p>
                {entry.note && <p>{entry.note}</p>}
                {entry.idempotencyKey && (
                  <p>
                    Idempotency-Key: <span className="mono">{entry.idempotencyKey}</span>
                  </p>
                )}
                {entry.requestBody !== undefined && (
                  <>
                    <p className="label">Request</p>
                    <pre>{JSON.stringify(entry.requestBody, null, 2)}</pre>
                  </>
                )}
                {entry.responseBody !== undefined && (
                  <>
                    <p className="label">Response</p>
                    <pre>{JSON.stringify(entry.responseBody, null, 2)}</pre>
                  </>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </aside>
  )
}
