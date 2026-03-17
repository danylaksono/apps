import { AlertCircle, Compass, Download } from 'lucide-react';

export default function PosterPanel({
  status,
  errorMessage,
  canvasRef,
  cityName,
  onDownload,
  onRetry,
}) {
  return (
    <section className="poster-region">
      <div className="poster-frame">
        {status === 'idle' && (
          <div className="status-card muted">
            <Compass size={68} strokeWidth={1.2} />
            <p>Select a city to begin</p>
          </div>
        )}

        {status === 'loading' && (
          <div className="status-card">
            <div className="spinner" />
            <p>Extracting urban geometry</p>
          </div>
        )}

        {status === 'error' && (
          <div className="status-card error">
            <AlertCircle size={40} />
            <h2>Process failed</h2>
            <p>{errorMessage}</p>
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={1600}
          height={2000}
          className={`poster-canvas ${status === 'success' ? 'visible' : ''}`}
        />

        {status === 'success' && (
          <button type="button" className="download-button" onClick={onDownload}>
            <Download size={18} />
            Export
            <span>{cityName}</span>
          </button>
        )}
      </div>
    </section>
  );
}
