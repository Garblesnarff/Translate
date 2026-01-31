/**
 * LineageSearch
 *
 * Search component for finding people in the lineage graph.
 * Provides typeahead search with results filtered by name.
 */

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, X, User } from 'lucide-react';
import type { Entity } from '../../hooks/useLineage';

// ============================================================================
// Types
// ============================================================================

export interface LineageSearchProps {
  entities: Entity[];
  onSelectEntity: (entity: Entity) => void;
  placeholder?: string;
  maxResults?: number;
}

export interface SearchResult {
  entity: Entity;
  score: number;
  matchedField: 'canonical' | 'wylie' | 'tibetan' | 'english';
}

// ============================================================================
// Component
// ============================================================================

export function LineageSearch({
  entities,
  onSelectEntity,
  placeholder = 'Search for person...',
  maxResults = 10,
}: LineageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    return searchEntities(entities, searchQuery, maxResults);
  }, [entities, searchQuery, maxResults]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest('.lineage-search')) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle entity selection
  function handleSelectEntity(entity: Entity) {
    onSelectEntity(entity);
    setSearchQuery('');
    setIsOpen(false);
  }

  // Clear search
  function handleClear() {
    setSearchQuery('');
    setIsOpen(false);
  }

  return (
    <div className="lineage-search relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && searchResults.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg">
          <ScrollArea className="max-h-[400px]">
            <div className="p-1">
              {searchResults.map(({ entity, matchedField }) => (
                <button
                  key={entity.id}
                  onClick={() => handleSelectEntity(entity)}
                  className="w-full flex items-start gap-3 p-3 hover:bg-accent rounded-sm transition-colors text-left"
                >
                  <User className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {entity.canonical_name}
                    </div>
                    {entity.attributes.wylie_name && (
                      <div className="text-xs text-muted-foreground truncate italic">
                        {entity.attributes.wylie_name}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {entity.attributes.birth_year && entity.attributes.death_year && (
                        <span className="text-xs text-muted-foreground">
                          {entity.attributes.birth_year} - {entity.attributes.death_year}
                        </span>
                      )}
                      {entity.attributes.tradition && entity.attributes.tradition.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {entity.attributes.tradition[0]}
                        </Badge>
                      )}
                      {matchedField !== 'canonical' && (
                        <Badge variant="outline" className="text-xs">
                          {matchedField}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* No Results */}
      {isOpen && searchQuery && searchResults.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg p-4 text-center text-sm text-muted-foreground">
          No results found for "{searchQuery}"
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Search Utilities
// ============================================================================

/**
 * Search entities by name (canonical, Wylie, Tibetan, English)
 */
function searchEntities(
  entities: Entity[],
  query: string,
  maxResults: number
): SearchResult[] {
  const queryLower = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const entity of entities) {
    // Skip non-person entities
    if (entity.type !== 'person') continue;

    let score = 0;
    let matchedField: SearchResult['matchedField'] = 'canonical';

    // Check canonical name
    const canonicalName = entity.canonical_name.toLowerCase();
    if (canonicalName.includes(queryLower)) {
      score = canonicalName.startsWith(queryLower) ? 100 : 80;
      matchedField = 'canonical';
    }

    // Check Wylie name
    if (entity.attributes.wylie_name) {
      const wylieName = entity.attributes.wylie_name.toLowerCase();
      if (wylieName.includes(queryLower)) {
        const wylieScore = wylieName.startsWith(queryLower) ? 90 : 70;
        if (wylieScore > score) {
          score = wylieScore;
          matchedField = 'wylie';
        }
      }
    }

    // Check English name variants
    if (entity.names.english) {
      for (const englishName of entity.names.english) {
        const nameLower = englishName.toLowerCase();
        if (nameLower.includes(queryLower)) {
          const englishScore = nameLower.startsWith(queryLower) ? 85 : 65;
          if (englishScore > score) {
            score = englishScore;
            matchedField = 'english';
          }
        }
      }
    }

    // Check Tibetan name
    if (entity.attributes.tibetan_name) {
      const tibetanName = entity.attributes.tibetan_name.toLowerCase();
      if (tibetanName.includes(queryLower)) {
        const tibetanScore = tibetanName.startsWith(queryLower) ? 95 : 75;
        if (tibetanScore > score) {
          score = tibetanScore;
          matchedField = 'tibetan';
        }
      }
    }

    // Add to results if matched
    if (score > 0) {
      results.push({ entity, score, matchedField });
    }
  }

  // Sort by score (descending) and return top results
  return results
    .sort((a, b) => {
      // Primary: score
      if (b.score !== a.score) return b.score - a.score;

      // Secondary: verified status
      if (a.entity.verified !== b.entity.verified) {
        return a.entity.verified ? -1 : 1;
      }

      // Tertiary: confidence
      return b.entity.confidence - a.entity.confidence;
    })
    .slice(0, maxResults);
}

// ============================================================================
// Compact Search (for mobile)
// ============================================================================

export interface CompactLineageSearchProps {
  entities: Entity[];
  onSelectEntity: (entity: Entity) => void;
}

export function CompactLineageSearch({
  entities,
  onSelectEntity,
}: CompactLineageSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchEntities(entities, searchQuery, 5);
  }, [entities, searchQuery]);

  function handleSelectEntity(entity: Entity) {
    onSelectEntity(entity);
    setSearchQuery('');
    setIsOpen(false);
  }

  return (
    <div className="lineage-search-compact relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-8 pr-8 h-8 text-sm"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setIsOpen(false);
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {isOpen && searchResults.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg">
          <div className="p-1">
            {searchResults.map(({ entity }) => (
              <button
                key={entity.id}
                onClick={() => handleSelectEntity(entity)}
                className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-sm text-left text-sm"
              >
                <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{entity.canonical_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
