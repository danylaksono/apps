import React from 'react';
import useStore from '../store/useStore';

export default function ProgressBar() {
  const isAnalyzing = useStore(s => s.isAnalyzing);
  const progress = useStore(s => s.progress);

  if (!isAnalyzing && progress === 0) return null;

  return (
    <>
      <div className={`progress-wrap${isAnalyzing ? ' visible' : ''}`}>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <style>{`
        .progress-wrap {
          margin-top: 16px;
          display: none;
        }
        .progress-wrap.visible { display: block; }
        .progress-bar-bg {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 3px;
          height: 4px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: var(--amber);
          border-radius: 3px;
          transition: width 0.3s ease;
          width: 0%;
        }
      `}</style>
    </>
  );
}
