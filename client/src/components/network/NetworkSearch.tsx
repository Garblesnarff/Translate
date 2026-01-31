/**
 * Network Search Component
 *
 * Search functionality for finding nodes in the network and highlighting paths.
 * Supports fuzzy matching and path finding between two selected nodes.
 */

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, X, GitMerge } from 'lucide-react';
import type { D3Node, D3Link } from '@/types/network';
import { findShortestPath } from '@/lib/forceSimulation';

// ============================================================================
// Props
// ============================================================================

export interface NetworkSearchProps {
  nodes: D3Node[];
  links: D3Link[];
  onNodeSelect: (node: D3Node) => void;
  onPathHighlight: (nodeIds: string[], linkIds: string[]) => void;
  onClearHighlight: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function fuzzyMatch(query: string, text: string): boolean {
  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();

  // Simple substring match
  return normalizedText.includes(normalizedQuery);
}

function searchNodes(nodes: D3Node[], query: string): D3Node[] {
  if (!query.trim()) return [];

  return nodes.filter(node => {
    // Search in canonical name
    if (fuzzyMatch(query, node.entity.canonicalName)) return true;

    // Search in alternative names
    if (node.entity.names.english?.some(name => fuzzyMatch(query, name))) return true;
    if (node.entity.names.tibetan?.some(name => fuzzyMatch(query, name))) return true;
    if (node.entity.names.phonetic?.some(name => fuzzyMatch(query, name))) return true;

    // Search in entity type
    if (fuzzyMatch(query, node.entity.type)) return true;

    return false;
  });
}

// ============================================================================
// Component
// ============================================================================

export function NetworkSearch({
  nodes,
  links,
  onNodeSelect,
  onPathHighlight,
  onClearHighlight,
}: NetworkSearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [selectedNodesForPath, setSelectedNodesForPath] = useState<D3Node[]>([]);

  // Search results
  const searchResults = useMemo(
    () => searchNodes(nodes, query),
    [nodes, query]
  );

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleClearSearch = () => {
    setQuery('');
    onClearHighlight();
  };

  const handleResultClick = (node: D3Node) => {
    onNodeSelect(node);

    // Highlight the node
    onPathHighlight([node.id], []);
  };

  const handleAddToPathSelection = (node: D3Node) => {
    if (selectedNodesForPath.length >= 2) {
      // Reset and start new selection
      setSelectedNodesForPath([node]);
    } else {
      setSelectedNodesForPath(prev => [...prev, node]);
    }
  };

  const handleFindPath = () => {
    if (selectedNodesForPath.length !== 2) return;

    const [start, end] = selectedNodesForPath;
    const path = findShortestPath(start.id, end.id, nodes, links);

    if (path) {
      const nodeIds = path.nodes.map(n => n.id);
      const linkIds = path.links.map(l => l.id);
      onPathHighlight(nodeIds, linkIds);
    }
  };

  const handleClearPathSelection = () => {
    setSelectedNodesForPath([]);
    onClearHighlight();
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search entities..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Search Results */}
        {query && searchResults.length > 0 && (
          <div className="max-h-60 overflow-y-auto border rounded-md">
            {searchResults.map(node => (
              <div
                key={node.id}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 flex items-center justify-between"
              >
                <div
                  onClick={() => handleResultClick(node)}
                  className="flex-1"
                >
                  <div className="font-medium text-sm">
                    {node.entity.canonicalName}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {node.entity.type}
                    </Badge>
                    {node.entity.attributes.tradition && (
                      <Badge variant="secondary" className="text-xs">
                        {node.entity.attributes.tradition[0]}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-500">
                      {node.degree} connections
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddToPathSelection(node)}
                  className="ml-2"
                >
                  <GitMerge className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* No Results */}
        {query && searchResults.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">
            No entities found matching "{query}"
          </div>
        )}

        {/* Path Finding */}
        {selectedNodesForPath.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <GitMerge className="w-4 h-4" />
                Find Path
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearPathSelection}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {selectedNodesForPath.map((node, index) => (
              <div key={node.id} className="flex items-center gap-2">
                <Badge>{index === 0 ? 'Start' : 'End'}</Badge>
                <span className="text-sm flex-1 truncate">
                  {node.entity.canonicalName}
                </span>
              </div>
            ))}

            {selectedNodesForPath.length === 2 && (
              <Button
                onClick={handleFindPath}
                className="w-full mt-2"
                size="sm"
              >
                Find Shortest Path
              </Button>
            )}

            {selectedNodesForPath.length === 1 && (
              <p className="text-xs text-gray-500 mt-2">
                Select another entity to find path
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default NetworkSearch;
