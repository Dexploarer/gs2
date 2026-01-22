/**
 * Agent Filters Component
 *
 * 2026 Best Practices:
 * - Client Component with React 19.1
 * - useActionState for form handling
 * - Search params for state persistence
 * - Optimistic UI updates
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Search, SlidersHorizontal, X } from 'lucide-react';

interface AgentFiltersProps {
  initialFilters?: {
    category?: string;
    minScore?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}

export function AgentFilters({ initialFilters = {} }: AgentFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [search, setSearch] = useState(initialFilters.search || '');
  const [category, setCategory] = useState(initialFilters.category || '');
  const [minScore, setMinScore] = useState(initialFilters.minScore || '');
  const [sortBy, setSortBy] = useState(initialFilters.sortBy || 'REPUTATION');
  const [sortOrder, setSortOrder] = useState(initialFilters.sortOrder || 'DESC');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams(searchParams.toString());

    if (search) params.set('search', search);
    else params.delete('search');

    if (category) params.set('category', category);
    else params.delete('category');

    if (minScore) params.set('minScore', minScore);
    else params.delete('minScore');

    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    params.delete('page'); // Reset to page 1

    router.push(`/agents?${params.toString()}`);
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategory('');
    setMinScore('');
    setSortBy('REPUTATION');
    setSortOrder('DESC');
    router.push('/agents');
  };

  const hasActiveFilters = search || category || minScore || sortBy !== 'REPUTATION' || sortOrder !== 'DESC';

  return (
    <div className="mb-6 space-y-4">
      {/* Search Bar */}
      <form onSubmit={handleSearch}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search agents by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
          </Button>
          <Button type="submit">Search</Button>
        </div>
      </form>

      {/* Advanced Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All categories</SelectItem>
                    <SelectItem value="chatbot">Chatbot</SelectItem>
                    <SelectItem value="code-assistant">Code Assistant</SelectItem>
                    <SelectItem value="analyst">Analyst</SelectItem>
                    <SelectItem value="researcher">Researcher</SelectItem>
                    <SelectItem value="content-creator">Content Creator</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Minimum Score */}
              <div className="space-y-2">
                <Label htmlFor="minScore">Min Reputation</Label>
                <Select value={minScore} onValueChange={setMinScore}>
                  <SelectTrigger id="minScore">
                    <SelectValue placeholder="Any score" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any score</SelectItem>
                    <SelectItem value="500">500+</SelectItem>
                    <SelectItem value="700">700+</SelectItem>
                    <SelectItem value="800">800+</SelectItem>
                    <SelectItem value="900">900+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By */}
              <div className="space-y-2">
                <Label htmlFor="sortBy">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sortBy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REPUTATION">Reputation</SelectItem>
                    <SelectItem value="TOTAL_VOTES">Total Votes</SelectItem>
                    <SelectItem value="AVERAGE_QUALITY">Average Quality</SelectItem>
                    <SelectItem value="CREATED_AT">Recently Added</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Order</Label>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger id="sortOrder">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESC">High to Low</SelectItem>
                    <SelectItem value="ASC">Low to High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4">
              <Button type="button" onClick={handleSearch} className="flex-1">
                Apply Filters
              </Button>
              {hasActiveFilters && (
                <Button type="button" variant="outline" onClick={handleClearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && !showFilters && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Active filters:</span>
          {search && <span className="font-medium">Search: {search}</span>}
          {category && <span className="font-medium">Category: {category}</span>}
          {minScore && <span className="font-medium">Min Score: {minScore}+</span>}
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
