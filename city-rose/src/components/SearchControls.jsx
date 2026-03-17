import { Loader2, Search } from 'lucide-react';

export default function SearchControls({
  searchQuery,
  onSearchQueryChange,
  onGenerate,
  isLoading,
}) {
  return (
    <header className="control-shell">
      <div className="search-box">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search city (for example: Barcelona, Spain)"
          value={searchQuery}
          onChange={(event) => {
            onSearchQueryChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onGenerate();
            }
          }}
        />
      </div>
      <button type="button" className="generate-button" onClick={onGenerate} disabled={isLoading}>
        {isLoading ? <Loader2 size={18} className="spin" /> : 'Generate'}
      </button>
    </header>
  );
}
