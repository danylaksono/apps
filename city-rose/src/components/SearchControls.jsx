import { Loader2, Search, MapPin } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

export default function SearchControls({
  searchQuery,
  onSearchQueryChange,
  onGenerate,
  isLoading,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&layer=city&limit=5`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.features) {
          setSuggestions(data.features.map(f => {
            const parts = [f.properties.name, f.properties.state, f.properties.country].filter(Boolean);
            return {
              id: f.properties.osm_id || Math.random(),
              name: parts.join(', ')
            };
          }).filter((v, i, a) => a.findIndex(t => t.name === v.name) === i));
        }
      } catch (e) {
        console.error("Geocoding error", e);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  return (
    <div className="flex w-full max-w-sm items-center gap-2" ref={wrapperRef}>
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="City (e.g. Barcelona, Spain)"
          className="pl-8 h-9 bg-white"
          value={searchQuery}
          onFocus={() => setShowSuggestions(true)}
          onChange={(event) => {
            onSearchQueryChange(event.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setShowSuggestions(false);
              onGenerate();
            }
          }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  onSearchQueryChange(suggestion.name);
                  setShowSuggestions(false);
                  setTimeout(() => onGenerate(), 0);
                }}
              >
                <MapPin size={14} className="text-gray-400 shrink-0" />
                <span className="truncate">{suggestion.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Button 
        type="button" 
        onClick={() => {
          setShowSuggestions(false);
          onGenerate();
        }} 
        disabled={isLoading}
        className="h-9 px-5 font-semibold text-sm"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
      </Button>
    </div>
  );
}
