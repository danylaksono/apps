import React, { useRef, useState } from 'react';
import useStore from '../store/useStore';

export default function DropZone() {
  const addFiles = useStore(s => s.addFiles);
  const [isDragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleClick = () => inputRef.current?.click();

  const processFileList = (fileList) => {
    const parquets = [...fileList].filter(f => f.name.endsWith('.parquet'));
    if (parquets.length) addFiles(parquets);
  };

  return (
    <>
      <div
        className={`drop-zone${isDragOver ? ' drag-over' : ''}`}
        onClick={handleClick}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); processFileList(e.dataTransfer.files); }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".parquet"
          style={{ display: 'none' }}
          onChange={e => processFileList(e.target.files)}
        />
        <div className="drop-icon">📂</div>
        <div className="drop-title">Drop GeoParquet files here</div>
        <div className="drop-sub">or click to browse · .parquet files only · multiple supported</div>
      </div>

      <style>{`
        .drop-zone {
          border: 1.5px dashed var(--border2);
          border-radius: 8px;
          padding: 48px 32px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          position: relative;
          overflow: hidden;
        }
        .drop-zone::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(245, 166, 35, 0.04) 0%, transparent 65%);
          pointer-events: none;
        }
        .drop-zone:hover, .drop-zone.drag-over {
          border-color: var(--amber);
          background: rgba(245, 166, 35, 0.03);
        }
        .drop-icon {
          width: 48px;
          height: 48px;
          margin: 0 auto 16px;
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
        }
        .drop-title {
          font-size: 15px;
          font-weight: 500;
          color: var(--text);
          margin-bottom: 6px;
        }
        .drop-sub {
          font-size: 12px;
          color: var(--muted);
          font-family: 'Source Code Pro', monospace;
        }
      `}</style>
    </>
  );
}
