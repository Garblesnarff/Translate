import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  GitMerge,
  X,
  HelpCircle,
  Edit3,
  CheckCheck,
  AlertTriangle,
  ArrowRight,
  FileText,
  Calendar,
  MapPin,
  User,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// Mock data types
interface EntityAttribute {
  name: string;
  value: string;
  confidence: number;
  source: string;
}

interface EntityRelationship {
  type: string;
  target: string;
  confidence: number;
}

interface Entity {
  id: string;
  name: string;
  type: 'person' | 'place' | 'text' | 'organization' | 'concept';
  attributes: EntityAttribute[];
  relationships: EntityRelationship[];
  sourceCount: number;
  firstSeen: string;
  lastSeen: string;
}

interface EntityPair {
  id: string;
  entity1: Entity;
  entity2: Entity;
  similarityScore: number;
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'merged' | 'rejected' | 'flagged';
  detectedDate: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

// Mock data generator
const generateMockData = (): EntityPair[] => {
  return [
    {
      id: '1',
      entity1: {
        id: 'e1',
        name: 'Marpa Lotsawa',
        type: 'person',
        attributes: [
          { name: 'birth_year', value: '1012', confidence: 0.92, source: 'Text A, Page 45' },
          { name: 'death_year', value: '1097', confidence: 0.89, source: 'Text A, Page 78' },
          { name: 'birthplace', value: 'Lhodrak', confidence: 0.85, source: 'Text B, Page 12' },
          { name: 'title', value: 'Great Translator', confidence: 0.95, source: 'Text A, Page 23' },
        ],
        relationships: [
          { type: 'student_of', target: 'Naropa', confidence: 0.98 },
          { type: 'teacher_of', target: 'Milarepa', confidence: 0.96 },
        ],
        sourceCount: 5,
        firstSeen: '2025-01-15',
        lastSeen: '2025-11-02',
      },
      entity2: {
        id: 'e2',
        name: 'Mar-pa',
        type: 'person',
        attributes: [
          { name: 'birth_year', value: '1012', confidence: 0.88, source: 'Text C, Page 34' },
          { name: 'birthplace', value: 'Southern Tibet', confidence: 0.75, source: 'Text C, Page 35' },
          { name: 'title', value: 'Translator', confidence: 0.82, source: 'Text D, Page 5' },
          { name: 'visits_to_india', value: '3', confidence: 0.90, source: 'Text C, Page 89' },
        ],
        relationships: [
          { type: 'student_of', target: 'Naropa', confidence: 0.94 },
          { type: 'teacher_of', target: 'Mila', confidence: 0.88 },
        ],
        sourceCount: 3,
        firstSeen: '2025-01-20',
        lastSeen: '2025-10-28',
      },
      similarityScore: 0.95,
      confidence: 'high',
      status: 'pending',
      detectedDate: '2025-11-05',
    },
    {
      id: '2',
      entity1: {
        id: 'e3',
        name: 'Sakya Monastery',
        type: 'place',
        attributes: [
          { name: 'founded', value: '1073', confidence: 0.95, source: 'Text E, Page 12' },
          { name: 'location', value: 'Shigatse, Tibet', confidence: 0.92, source: 'Text E, Page 13' },
          { name: 'founded_by', value: 'Khon Konchok Gyalpo', confidence: 0.89, source: 'Text E, Page 15' },
        ],
        relationships: [
          { type: 'home_of', target: 'Sakya school', confidence: 0.97 },
        ],
        sourceCount: 8,
        firstSeen: '2025-01-10',
        lastSeen: '2025-11-06',
      },
      entity2: {
        id: 'e4',
        name: 'Sa-skya dgon-pa',
        type: 'place',
        attributes: [
          { name: 'founded', value: '1073', confidence: 0.93, source: 'Text F, Page 45' },
          { name: 'location', value: 'Tsang region', confidence: 0.88, source: 'Text F, Page 46' },
        ],
        relationships: [
          { type: 'headquarters_of', target: 'Sakya tradition', confidence: 0.91 },
        ],
        sourceCount: 4,
        firstSeen: '2025-02-01',
        lastSeen: '2025-10-30',
      },
      similarityScore: 0.88,
      confidence: 'high',
      status: 'pending',
      detectedDate: '2025-11-04',
    },
    {
      id: '3',
      entity1: {
        id: 'e5',
        name: 'Hevajra Tantra',
        type: 'text',
        attributes: [
          { name: 'category', value: 'Highest Yoga Tantra', confidence: 0.96, source: 'Text G, Page 23' },
          { name: 'origin', value: 'India', confidence: 0.92, source: 'Text G, Page 24' },
          { name: 'chapters', value: '32', confidence: 0.88, source: 'Text H, Page 5' },
        ],
        relationships: [
          { type: 'transmitted_by', target: 'Virupa', confidence: 0.94 },
          { type: 'translated_by', target: 'Marpa', confidence: 0.89 },
        ],
        sourceCount: 6,
        firstSeen: '2025-01-25',
        lastSeen: '2025-11-01',
      },
      entity2: {
        id: 'e6',
        name: 'Kye Dorje Root Tantra',
        type: 'text',
        attributes: [
          { name: 'category', value: 'Anuttarayoga Tantra', confidence: 0.91, source: 'Text I, Page 67' },
          { name: 'origin', value: 'Indian Buddhism', confidence: 0.86, source: 'Text I, Page 68' },
        ],
        relationships: [
          { type: 'principal_deity', target: 'Hevajra', confidence: 0.93 },
        ],
        sourceCount: 3,
        firstSeen: '2025-02-10',
        lastSeen: '2025-10-25',
      },
      similarityScore: 0.78,
      confidence: 'medium',
      status: 'pending',
      detectedDate: '2025-11-03',
    },
    {
      id: '4',
      entity1: {
        id: 'e7',
        name: 'Milarepa',
        type: 'person',
        attributes: [
          { name: 'birth_year', value: '1052', confidence: 0.90, source: 'Text J, Page 12' },
          { name: 'death_year', value: '1135', confidence: 0.87, source: 'Text J, Page 156' },
          { name: 'birthplace', value: 'Gungthang', confidence: 0.83, source: 'Text K, Page 8' },
        ],
        relationships: [
          { type: 'student_of', target: 'Marpa', confidence: 0.97 },
          { type: 'teacher_of', target: 'Gampopa', confidence: 0.95 },
        ],
        sourceCount: 12,
        firstSeen: '2025-01-05',
        lastSeen: '2025-11-07',
      },
      entity2: {
        id: 'e8',
        name: 'Jetsun Mila',
        type: 'person',
        attributes: [
          { name: 'birth_year', value: '1040', confidence: 0.75, source: 'Text L, Page 22' },
          { name: 'practice', value: 'Tummo meditation', confidence: 0.92, source: 'Text L, Page 89' },
        ],
        relationships: [
          { type: 'disciple_of', target: 'Marpa', confidence: 0.90 },
        ],
        sourceCount: 5,
        firstSeen: '2025-01-18',
        lastSeen: '2025-10-20',
      },
      similarityScore: 0.85,
      confidence: 'high',
      status: 'pending',
      detectedDate: '2025-11-02',
    },
    {
      id: '5',
      entity1: {
        id: 'e9',
        name: 'Naropa',
        type: 'person',
        attributes: [
          { name: 'birth_year', value: '1016', confidence: 0.88, source: 'Text M, Page 45' },
          { name: 'death_year', value: '1100', confidence: 0.85, source: 'Text M, Page 234' },
          { name: 'university', value: 'Nalanda', confidence: 0.94, source: 'Text N, Page 12' },
        ],
        relationships: [
          { type: 'student_of', target: 'Tilopa', confidence: 0.96 },
          { type: 'teacher_of', target: 'Marpa', confidence: 0.97 },
        ],
        sourceCount: 9,
        firstSeen: '2025-01-08',
        lastSeen: '2025-11-05',
      },
      entity2: {
        id: 'e10',
        name: 'Naro Bon Chung',
        type: 'person',
        attributes: [
          { name: 'tradition', value: 'Bon', confidence: 0.92, source: 'Text O, Page 67' },
          { name: 'flying_contest', value: 'Mount Kailash', confidence: 0.89, source: 'Text O, Page 89' },
        ],
        relationships: [
          { type: 'rival_of', target: 'Milarepa', confidence: 0.93 },
        ],
        sourceCount: 2,
        firstSeen: '2025-03-01',
        lastSeen: '2025-09-15',
      },
      similarityScore: 0.42,
      confidence: 'low',
      status: 'pending',
      detectedDate: '2025-11-01',
    },
    {
      id: '6',
      entity1: {
        id: 'e11',
        name: 'Gampopa',
        type: 'person',
        attributes: [
          { name: 'birth_year', value: '1079', confidence: 0.91, source: 'Text P, Page 23' },
          { name: 'death_year', value: '1153', confidence: 0.89, source: 'Text P, Page 189' },
          { name: 'founded', value: 'Dagpo Kagyu', confidence: 0.93, source: 'Text Q, Page 45' },
        ],
        relationships: [
          { type: 'student_of', target: 'Milarepa', confidence: 0.96 },
        ],
        sourceCount: 7,
        firstSeen: '2025-01-12',
        lastSeen: '2025-11-03',
      },
      entity2: {
        id: 'e12',
        name: 'Dagpo Lhaje',
        type: 'person',
        attributes: [
          { name: 'title', value: 'Physician from Dagpo', confidence: 0.94, source: 'Text R, Page 12' },
          { name: 'medical_training', value: 'Yes', confidence: 0.88, source: 'Text R, Page 15' },
        ],
        relationships: [
          { type: 'disciple_of', target: 'Milarepa', confidence: 0.92 },
        ],
        sourceCount: 4,
        firstSeen: '2025-02-05',
        lastSeen: '2025-10-18',
      },
      similarityScore: 0.91,
      confidence: 'high',
      status: 'pending',
      detectedDate: '2025-10-31',
    },
  ];
};

// Component: Entity Type Icon
function EntityTypeIcon({ type }: { type: Entity['type'] }) {
  switch (type) {
    case 'person':
      return <User className="h-4 w-4" />;
    case 'place':
      return <MapPin className="h-4 w-4" />;
    case 'text':
      return <BookOpen className="h-4 w-4" />;
    case 'organization':
      return <FileText className="h-4 w-4" />;
    case 'concept':
      return <FileText className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

// Component: Confidence Badge
function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const variants = {
    high: 'bg-green-500',
    medium: 'bg-yellow-500',
    low: 'bg-red-500',
  };
  return (
    <Badge variant="default" className={variants[confidence]}>
      {confidence}
    </Badge>
  );
}

// Component: Similarity Score Display
function SimilarityScore({ score }: { score: number }) {
  const percentage = (score * 100).toFixed(0);
  const color = score >= 0.85 ? 'text-green-600' : score >= 0.70 ? 'text-yellow-600' : 'text-red-600';
  return (
    <div className={`font-semibold ${color}`}>
      {percentage}%
    </div>
  );
}

// Component: Entity Card for Side-by-Side Comparison
function EntityCard({ entity, diffFields }: { entity: Entity; diffFields: Set<string> }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EntityTypeIcon type={entity.type} />
            <CardTitle className="text-lg">{entity.name}</CardTitle>
          </div>
          <Badge variant="outline">{entity.type}</Badge>
        </div>
        <CardDescription>
          {entity.sourceCount} sources • First: {new Date(entity.firstSeen).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attributes */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Attributes</h4>
          <div className="space-y-2">
            {entity.attributes.map((attr, idx) => (
              <div
                key={idx}
                className={`p-2 rounded border ${diffFields.has(attr.name) ? 'bg-yellow-50 border-yellow-300' : 'bg-muted'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{attr.name.replace(/_/g, ' ')}</div>
                    <div className="text-sm">{attr.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{attr.source}</div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {(attr.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Relationships */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Relationships</h4>
          <div className="space-y-1">
            {entity.relationships.map((rel, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                <ArrowRight className="h-3 w-3" />
                <span className="font-medium">{rel.type.replace(/_/g, ' ')}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{rel.target}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {(rel.confidence * 100).toFixed(0)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Component: Merge Preview Dialog
function MergePreviewDialog({
  open,
  onOpenChange,
  pair,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pair: EntityPair | null;
  onConfirm: () => void;
}) {
  if (!pair) return null;

  const mergedAttributes = new Map<string, EntityAttribute>();

  // Merge logic: take highest confidence for each attribute
  pair.entity1.attributes.forEach(attr => {
    mergedAttributes.set(attr.name, attr);
  });

  pair.entity2.attributes.forEach(attr => {
    const existing = mergedAttributes.get(attr.name);
    if (!existing || attr.confidence > existing.confidence) {
      mergedAttributes.set(attr.name, attr);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Confirm Merge</DialogTitle>
          <DialogDescription>
            Review the merged entity before confirming. The system will keep the highest confidence values.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-4">
            <div>
              <Label>Merged Name</Label>
              <Input value={pair.entity1.name} className="font-semibold" readOnly />
            </div>

            <div>
              <Label>Entity Type</Label>
              <div className="flex items-center gap-2 mt-1">
                <EntityTypeIcon type={pair.entity1.type} />
                <Badge variant="outline">{pair.entity1.type}</Badge>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="mb-2 block">Merged Attributes ({mergedAttributes.size})</Label>
              <div className="space-y-2">
                {Array.from(mergedAttributes.values()).map((attr, idx) => (
                  <div key={idx} className="p-2 bg-muted rounded text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{attr.name.replace(/_/g, ' ')}</span>
                      <Badge variant="secondary">{(attr.confidence * 100).toFixed(0)}%</Badge>
                    </div>
                    <div className="mt-1">{attr.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{attr.source}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Total Sources</Label>
              <div className="text-2xl font-bold mt-1">
                {pair.entity1.sourceCount + pair.entity2.sourceCount}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700">
            <GitMerge className="h-4 w-4 mr-2" />
            Confirm Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Component
export default function EntityReviewDashboard() {
  const { toast } = useToast();
  const [mockData] = useState<EntityPair[]>(generateMockData());

  // State
  const [selectedPair, setSelectedPair] = useState<EntityPair | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [filterConfidence, setFilterConfidence] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'similarity' | 'date'>('similarity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMergePreview, setShowMergePreview] = useState(false);
  const [localData, setLocalData] = useState<EntityPair[]>(mockData);

  const itemsPerPage = 20;

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let filtered = localData.filter(pair => pair.status === 'pending');

    if (filterType !== 'all') {
      filtered = filtered.filter(pair => pair.entity1.type === filterType);
    }

    if (filterConfidence !== 'all') {
      filtered = filtered.filter(pair => pair.confidence === filterConfidence);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'similarity') {
        return sortOrder === 'desc'
          ? b.similarityScore - a.similarityScore
          : a.similarityScore - b.similarityScore;
      } else {
        return sortOrder === 'desc'
          ? new Date(b.detectedDate).getTime() - new Date(a.detectedDate).getTime()
          : new Date(a.detectedDate).getTime() - new Date(b.detectedDate).getTime();
      }
    });

    return filtered;
  }, [localData, filterType, filterConfidence, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get different fields between entities
  const getDiffFields = (pair: EntityPair): Set<string> => {
    const diffFields = new Set<string>();
    const attr1Map = new Map(pair.entity1.attributes.map(a => [a.name, a.value]));
    const attr2Map = new Map(pair.entity2.attributes.map(a => [a.name, a.value]));

    attr1Map.forEach((value, key) => {
      const value2 = attr2Map.get(key);
      if (value2 && value !== value2) {
        diffFields.add(key);
      }
    });

    return diffFields;
  };

  // Handlers
  const handleSelectPair = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map(p => p.id)));
    }
  };

  const handleMerge = (pairId: string) => {
    setShowMergePreview(true);
  };

  const handleConfirmMerge = () => {
    if (!selectedPair) return;

    setLocalData(prev =>
      prev.map(p => (p.id === selectedPair.id ? { ...p, status: 'merged' as const } : p))
    );

    toast({
      title: "Entities merged",
      description: `Successfully merged "${selectedPair.entity1.name}" and "${selectedPair.entity2.name}"`,
    });

    setShowMergePreview(false);
    setSelectedPair(null);
  };

  const handleReject = (pairId: string) => {
    const pair = localData.find(p => p.id === pairId);
    if (!pair) return;

    setLocalData(prev =>
      prev.map(p => (p.id === pairId ? { ...p, status: 'rejected' as const } : p))
    );

    toast({
      title: "Pair rejected",
      description: `Marked "${pair.entity1.name}" and "${pair.entity2.name}" as not the same`,
    });

    if (selectedPair?.id === pairId) {
      setSelectedPair(null);
    }
  };

  const handleFlag = (pairId: string) => {
    const pair = localData.find(p => p.id === pairId);
    if (!pair) return;

    setLocalData(prev =>
      prev.map(p => (p.id === pairId ? { ...p, status: 'flagged' as const } : p))
    );

    toast({
      title: "Flagged for review",
      description: `"${pair.entity1.name}" and "${pair.entity2.name}" flagged for expert review`,
      variant: "default",
    });

    if (selectedPair?.id === pairId) {
      setSelectedPair(null);
    }
  };

  const handleBulkMerge = () => {
    const selectedPairs = localData.filter(p => selectedIds.has(p.id));
    const highConfidenceOnly = selectedPairs.every(p => p.confidence === 'high');

    if (!highConfidenceOnly) {
      toast({
        title: "Cannot bulk merge",
        description: "Bulk merge only works for high-confidence matches",
        variant: "destructive",
      });
      return;
    }

    setLocalData(prev =>
      prev.map(p => (selectedIds.has(p.id) ? { ...p, status: 'merged' as const } : p))
    );

    toast({
      title: "Bulk merge complete",
      description: `Successfully merged ${selectedIds.size} entity pairs`,
    });

    setSelectedIds(new Set());
  };

  const handleBulkReject = () => {
    setLocalData(prev =>
      prev.map(p => (selectedIds.has(p.id) ? { ...p, status: 'rejected' as const } : p))
    );

    toast({
      title: "Bulk rejection complete",
      description: `Rejected ${selectedIds.size} entity pairs`,
    });

    setSelectedIds(new Set());
  };

  const stats = {
    pending: localData.filter(p => p.status === 'pending').length,
    merged: localData.filter(p => p.status === 'merged').length,
    rejected: localData.filter(p => p.status === 'rejected').length,
    flagged: localData.filter(p => p.status === 'flagged').length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Entity Resolution Review</h1>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <FileText className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Merged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.merged}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Flagged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.flagged}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Review Queue</TabsTrigger>
          <TabsTrigger value="comparison" disabled={!selectedPair}>
            Comparison View
          </TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          {/* Filters and Bulk Actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <CardTitle className="text-lg">Filters</CardTitle>
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleBulkMerge}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCheck className="h-4 w-4 mr-2" />
                      Merge Selected ({selectedIds.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkReject}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject Selected ({selectedIds.size})
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label>Entity Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="person">Person</SelectItem>
                      <SelectItem value="place">Place</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="concept">Concept</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <Label>Confidence</Label>
                  <Select value={filterConfidence} onValueChange={setFilterConfidence}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <Label>Sort By</Label>
                  <div className="flex gap-2">
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'similarity' | 'date')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="similarity">Similarity</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    >
                      {sortOrder === 'desc' ? (
                        <TrendingDown className="h-4 w-4" />
                      ) : (
                        <TrendingUp className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Review Queue Table */}
          <Card>
            <CardHeader>
              <CardTitle>Duplicate Candidates ({filteredData.length})</CardTitle>
              <CardDescription>
                Click a row to view detailed comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredData.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending reviews</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr className="text-left">
                          <th className="pb-3 w-12">
                            <Checkbox
                              checked={selectedIds.size === paginatedData.length && paginatedData.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </th>
                          <th className="pb-3 text-sm font-medium">Entity 1</th>
                          <th className="pb-3 text-sm font-medium">Entity 2</th>
                          <th className="pb-3 text-sm font-medium">Type</th>
                          <th className="pb-3 text-sm font-medium">Similarity</th>
                          <th className="pb-3 text-sm font-medium">Confidence</th>
                          <th className="pb-3 text-sm font-medium">Sources</th>
                          <th className="pb-3 text-sm font-medium">Date</th>
                          <th className="pb-3 text-sm font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedData.map((pair) => (
                          <tr
                            key={pair.id}
                            className={`border-b hover:bg-muted/50 cursor-pointer ${
                              selectedPair?.id === pair.id ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => setSelectedPair(pair)}
                          >
                            <td className="py-3">
                              <Checkbox
                                checked={selectedIds.has(pair.id)}
                                onCheckedChange={() => handleSelectPair(pair.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="py-3">
                              <div className="font-medium">{pair.entity1.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {pair.entity1.sourceCount} sources
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="font-medium">{pair.entity2.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {pair.entity2.sourceCount} sources
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                <EntityTypeIcon type={pair.entity1.type} />
                                <span className="text-sm capitalize">{pair.entity1.type}</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <SimilarityScore score={pair.similarityScore} />
                            </td>
                            <td className="py-3">
                              <ConfidenceBadge confidence={pair.confidence} />
                            </td>
                            <td className="py-3 text-sm">
                              {pair.entity1.sourceCount + pair.entity2.sourceCount}
                            </td>
                            <td className="py-3 text-sm">
                              {new Date(pair.detectedDate).toLocaleDateString()}
                            </td>
                            <td className="py-3">
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedPair(pair);
                                    handleMerge(pair.id);
                                  }}
                                  className="h-8 px-2"
                                >
                                  <GitMerge className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleReject(pair.id)}
                                  className="h-8 px-2"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleFlag(pair.id)}
                                  className="h-8 px-2"
                                >
                                  <HelpCircle className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          {selectedPair && (
            <>
              {/* Comparison Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Entity Comparison</CardTitle>
                      <CardDescription>
                        Similarity: <SimilarityScore score={selectedPair.similarityScore} /> •
                        Confidence: <ConfidenceBadge confidence={selectedPair.confidence} />
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          handleMerge(selectedPair.id);
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <GitMerge className="h-4 w-4 mr-2" />
                        Merge
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleReject(selectedPair.id)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Not the same
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleFlag(selectedPair.id)}
                      >
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Unsure
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <EntityCard entity={selectedPair.entity1} diffFields={getDiffFields(selectedPair)} />
                <EntityCard entity={selectedPair.entity2} diffFields={getDiffFields(selectedPair)} />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Merge Preview Dialog */}
      <MergePreviewDialog
        open={showMergePreview}
        onOpenChange={setShowMergePreview}
        pair={selectedPair}
        onConfirm={handleConfirmMerge}
      />
    </div>
  );
}
