/**
 * Relationship Validation Service
 *
 * Phase 3, Task 3.4: Comprehensive validation engine for relationships
 *
 * Validates relationships for:
 * - Type constraints (teacher_of: Person → Person only)
 * - Temporal consistency (birth/death timelines)
 * - Logical constraints (no circular relationships)
 * - Cross-reference validation (bidirectional relationships)
 *
 * Provides auto-correction suggestions and confidence adjustments.
 */

import type { Entity, Relationship, PredicateType, EntityType, DateInfo } from '../../types/entities';

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: ValidationWarning[];
  suggestions: Correction[];
  confidence: number; // Adjusted confidence (reduced if issues found)
  originalConfidence: number;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'type' | 'temporal' | 'logical' | 'reference';
  message: string;
  affectedEntities: string[];
  suggestion?: string;
  code?: string; // Error code for programmatic handling
}

export interface ValidationWarning extends ValidationIssue {
  severity: 'warning';
  autoFixable?: boolean;
}

export interface Correction {
  type: 'modify_date' | 'add_relationship' | 'remove_relationship' | 'mark_disputed' | 'merge_entities';
  description: string;
  affectedEntities: string[];
  confidence: number; // How confident we are in this correction
  autoApply?: boolean; // Whether this can be auto-applied
  changes?: {
    field: string;
    currentValue: any;
    suggestedValue: any;
  }[];
}

export interface BatchValidationReport {
  totalRelationships: number;
  validRelationships: number;
  invalidRelationships: number;
  totalIssues: number;
  issuesByCategory: Record<string, number>;
  issueBySeverity: Record<string, number>;
  averageConfidence: number;
  systematicIssues: SystematicIssue[];
  recommendations: string[];
}

export interface SystematicIssue {
  pattern: string;
  occurrences: number;
  affectedRelationships: string[];
  suggestedFix: string;
}

export interface Cycle {
  predicate: PredicateType;
  entityIds: string[];
  description: string;
}

// ============================================================================
// Type Constraint Definitions
// ============================================================================

interface TypeConstraint {
  subject: EntityType | EntityType[];
  object: EntityType | EntityType[];
  description: string;
}

const TYPE_CONSTRAINTS: Record<PredicateType, TypeConstraint> = {
  // Teacher-Student relationships
  teacher_of: {
    subject: 'person',
    object: 'person',
    description: 'Teacher must be person, student must be person'
  },
  student_of: {
    subject: 'person',
    object: 'person',
    description: 'Student must be person, teacher must be person'
  },

  // Incarnation relationships
  incarnation_of: {
    subject: 'person',
    object: 'person',
    description: 'Both incarnations must be persons'
  },

  // Authorship relationships
  wrote: {
    subject: 'person',
    object: 'text',
    description: 'Author must be person, work must be text'
  },
  translated: {
    subject: 'person',
    object: 'text',
    description: 'Translator must be person, work must be text'
  },
  compiled: {
    subject: 'person',
    object: 'text',
    description: 'Compiler must be person, work must be text'
  },

  // Spatial relationships
  lived_at: {
    subject: 'person',
    object: ['place', 'institution'],
    description: 'Person must live at place or institution'
  },
  visited: {
    subject: 'person',
    object: 'place',
    description: 'Person must visit place'
  },
  founded: {
    subject: 'person',
    object: ['place', 'institution'],
    description: 'Founder must be person, founded entity must be place or institution'
  },
  born_in: {
    subject: 'person',
    object: 'place',
    description: 'Person must be born in place'
  },
  died_in: {
    subject: 'person',
    object: 'place',
    description: 'Person must die in place'
  },

  // Event participation
  attended: {
    subject: 'person',
    object: 'event',
    description: 'Attendee must be person, attended must be event'
  },
  organized: {
    subject: 'person',
    object: 'event',
    description: 'Organizer must be person, organized must be event'
  },
  sponsored: {
    subject: 'person',
    object: ['event', 'institution', 'text'],
    description: 'Sponsor must be person, sponsored can be event, institution, or text'
  },

  // Institutional relationships
  member_of: {
    subject: 'person',
    object: 'institution',
    description: 'Member must be person, institution must be institution'
  },
  abbot_of: {
    subject: 'person',
    object: 'institution',
    description: 'Abbot must be person, institution must be institution'
  },
  patron_of: {
    subject: 'person',
    object: ['person', 'institution', 'text'],
    description: 'Patron must be person, beneficiary can be person, institution, or text'
  },

  // Textual relationships
  commentary_on: {
    subject: 'text',
    object: 'text',
    description: 'Both subject and object must be texts'
  },
  cites: {
    subject: 'text',
    object: 'text',
    description: 'Both subject and object must be texts'
  },
  part_of: {
    subject: ['text', 'place'],
    object: ['text', 'place'],
    description: 'Part and whole must be same type (text or place)'
  },
  contains: {
    subject: ['text', 'place'],
    object: ['text', 'place'],
    description: 'Container and contained must be same type (text or place)'
  },
  mentions: {
    subject: 'text',
    object: ['person', 'place', 'event', 'concept', 'deity'],
    description: 'Text can mention person, place, event, concept, or deity'
  },

  // Transmission relationships
  received_transmission: {
    subject: 'person',
    object: 'person',
    description: 'Both receiver and transmitter must be persons'
  },
  gave_empowerment: {
    subject: 'person',
    object: 'person',
    description: 'Both giver and receiver must be persons'
  },
  transmitted_to: {
    subject: 'person',
    object: 'person',
    description: 'Both transmitter and receiver must be persons'
  },

  // Debate relationships
  debated_with: {
    subject: 'person',
    object: 'person',
    description: 'Both debaters must be persons'
  },
  refuted: {
    subject: ['person', 'text'],
    object: ['concept', 'text'],
    description: 'Refuter can be person or text, refuted can be concept or text'
  },
  agreed_with: {
    subject: 'person',
    object: ['person', 'concept'],
    description: 'Subject must be person, object can be person or concept'
  },

  // Family relationships
  parent_of: {
    subject: 'person',
    object: 'person',
    description: 'Both parent and child must be persons'
  },
  child_of: {
    subject: 'person',
    object: 'person',
    description: 'Both child and parent must be persons'
  },
  sibling_of: {
    subject: 'person',
    object: 'person',
    description: 'Both siblings must be persons'
  },
  spouse_of: {
    subject: 'person',
    object: 'person',
    description: 'Both spouses must be persons'
  },

  // Geographic relationships
  within: {
    subject: 'place',
    object: 'place',
    description: 'Both subject and object must be places'
  },
  near: {
    subject: 'place',
    object: 'place',
    description: 'Both subject and object must be places'
  },

  // Conceptual relationships
  practiced: {
    subject: 'person',
    object: 'concept',
    description: 'Practitioner must be person, practice must be concept'
  },
  held_view: {
    subject: 'person',
    object: 'concept',
    description: 'Subject must be person, view must be concept'
  },
  taught_concept: {
    subject: 'person',
    object: 'concept',
    description: 'Teacher must be person, concept must be concept'
  },

  // Temporal relationships
  preceded: {
    subject: 'event',
    object: 'event',
    description: 'Both subject and object must be events'
  },
  followed: {
    subject: 'event',
    object: 'event',
    description: 'Both subject and object must be events'
  },
  contemporary_with: {
    subject: 'person',
    object: 'person',
    description: 'Both subjects must be persons'
  },
  potential_duplicate_of: {
    subject: ['person', 'place', 'text', 'event', 'lineage', 'concept', 'institution', 'deity'],
    object: ['person', 'place', 'text', 'event', 'lineage', 'concept', 'institution', 'deity'],
    description: 'Any entity can be a potential duplicate of another entity'
  },
};

// ============================================================================
// Bidirectional Relationship Pairs
// ============================================================================

const BIDIRECTIONAL_PAIRS: Record<PredicateType, PredicateType | null> = {
  teacher_of: 'student_of',
  student_of: 'teacher_of',
  parent_of: 'child_of',
  child_of: 'parent_of',
  // Symmetric relationships (same predicate both ways)
  sibling_of: 'sibling_of',
  spouse_of: 'spouse_of',
  debated_with: 'debated_with',
  contemporary_with: 'contemporary_with',
  // Unidirectional relationships
  wrote: null,
  translated: null,
  compiled: null,
  lived_at: null,
  visited: null,
  founded: null,
  born_in: null,
  died_in: null,
  attended: null,
  organized: null,
  sponsored: null,
  member_of: null,
  abbot_of: null,
  patron_of: null,
  commentary_on: null,
  cites: null,
  part_of: null,
  contains: null,
  mentions: null,
  received_transmission: null,
  gave_empowerment: null,
  transmitted_to: null,
  refuted: null,
  agreed_with: null,
  within: null,
  near: null,
  practiced: null,
  held_view: null,
  taught_concept: null,
  preceded: null,
  followed: null,
  incarnation_of: null,
  potential_duplicate_of: null,
};

// ============================================================================
// RelationshipValidator Class
// ============================================================================

export class RelationshipValidator {
  /**
   * Validate a single relationship
   */
  validateRelationship(
    relationship: Relationship,
    entities: Map<string, Entity>,
    allRelationships: Relationship[] = []
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: Correction[] = [];

    // Get subject and object entities
    const subject = entities.get(relationship.subjectId);
    const object = entities.get(relationship.objectId);

    if (!subject || !object) {
      return {
        valid: false,
        issues: [{
          severity: 'error',
          category: 'reference',
          message: 'Subject or object entity not found',
          affectedEntities: [relationship.subjectId, relationship.objectId],
          code: 'MISSING_ENTITY'
        }],
        warnings: [],
        suggestions: [],
        confidence: 0,
        originalConfidence: relationship.confidence
      };
    }

    // Run all validation checks
    issues.push(...this.checkTypeConstraints(relationship, subject, object));
    issues.push(...this.checkTemporalConsistency(relationship, subject, object));
    issues.push(...this.checkLogicalConstraints(relationship, allRelationships));

    const crossRefResults = this.checkCrossReferences(relationship, entities, allRelationships);
    warnings.push(...crossRefResults.warnings);
    suggestions.push(...crossRefResults.suggestions);

    // Generate suggestions for each issue
    for (const issue of issues) {
      const issueSuggestions = this.suggestCorrections(issue, relationship, subject, object);
      suggestions.push(...issueSuggestions);
    }

    // Calculate adjusted confidence
    const adjustedConfidence = this.adjustConfidence(relationship.confidence, issues, warnings);

    return {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      warnings,
      suggestions,
      confidence: adjustedConfidence,
      originalConfidence: relationship.confidence
    };
  }

  /**
   * Check type constraints for relationship
   */
  checkTypeConstraints(
    relationship: Relationship,
    subject: Entity,
    object: Entity
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const constraint = TYPE_CONSTRAINTS[relationship.predicate];

    if (!constraint) {
      issues.push({
        severity: 'error',
        category: 'type',
        message: `Unknown predicate type: ${relationship.predicate}`,
        affectedEntities: [relationship.subjectId, relationship.objectId],
        code: 'UNKNOWN_PREDICATE'
      });
      return issues;
    }

    // Check subject type
    const validSubjectTypes = Array.isArray(constraint.subject)
      ? constraint.subject
      : [constraint.subject];

    if (!validSubjectTypes.includes(subject.type)) {
      issues.push({
        severity: 'error',
        category: 'type',
        message: `Invalid subject type for ${relationship.predicate}: expected ${validSubjectTypes.join(' or ')}, got ${subject.type}`,
        affectedEntities: [relationship.subjectId],
        suggestion: `Change subject to ${validSubjectTypes.join(' or ')} entity`,
        code: 'INVALID_SUBJECT_TYPE'
      });
    }

    // Check object type
    const validObjectTypes = Array.isArray(constraint.object)
      ? constraint.object
      : [constraint.object];

    if (!validObjectTypes.includes(object.type)) {
      issues.push({
        severity: 'error',
        category: 'type',
        message: `Invalid object type for ${relationship.predicate}: expected ${validObjectTypes.join(' or ')}, got ${object.type}`,
        affectedEntities: [relationship.objectId],
        suggestion: `Change object to ${validObjectTypes.join(' or ')} entity`,
        code: 'INVALID_OBJECT_TYPE'
      });
    }

    return issues;
  }

  /**
   * Check temporal consistency
   */
  checkTemporalConsistency(
    relationship: Relationship,
    subject: Entity,
    object: Entity
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Birth-Death checks for person entities
    if (subject.type === 'person' && subject.dates) {
      const birthDate = subject.dates.birth;
      const deathDate = subject.dates.death;
      const relDate = relationship.properties.date;

      // Person can't do anything before birth
      if (birthDate && relDate && this.compareYears(relDate, birthDate) < 0) {
        issues.push({
          severity: 'error',
          category: 'temporal',
          message: `${subject.canonicalName} performed action before birth (birth: ${this.formatYear(birthDate)}, action: ${this.formatYear(relDate)})`,
          affectedEntities: [subject.id],
          suggestion: `Check birth date accuracy or event date accuracy`,
          code: 'ACTION_BEFORE_BIRTH'
        });
      }

      // Person can't do anything after death (with some exceptions)
      if (deathDate && relDate && this.compareYears(relDate, deathDate) > 0) {
        const allowedPostDeath = ['wrote', 'compiled']; // Texts can be discovered/published after death
        if (!allowedPostDeath.includes(relationship.predicate)) {
          issues.push({
            severity: 'error',
            category: 'temporal',
            message: `${subject.canonicalName} performed action after death (death: ${this.formatYear(deathDate)}, action: ${this.formatYear(relDate)})`,
            affectedEntities: [subject.id],
            suggestion: `Check death date accuracy or event date accuracy`,
            code: 'ACTION_AFTER_DEATH'
          });
        }
      }

      // Teacher-student age checks
      if (relationship.predicate === 'teacher_of' && object.type === 'person' && object.dates?.birth) {
        const teacherBirth = birthDate;
        const studentBirth = object.dates.birth;

        if (teacherBirth && studentBirth) {
          const ageDiff = this.getYearValue(studentBirth) - this.getYearValue(teacherBirth);

          // Teacher should usually be older than student
          if (ageDiff > 0 && ageDiff < 10) {
            issues.push({
              severity: 'warning',
              category: 'temporal',
              message: `Teacher ${subject.canonicalName} is only ${ageDiff} years older than student ${object.canonicalName}`,
              affectedEntities: [subject.id, object.id],
              suggestion: `Verify birth dates are correct`,
              code: 'UNUSUAL_AGE_DIFFERENCE'
            });
          }

          if (ageDiff < 0) {
            issues.push({
              severity: 'error',
              category: 'temporal',
              message: `Teacher ${subject.canonicalName} is younger than student ${object.canonicalName}`,
              affectedEntities: [subject.id, object.id],
              suggestion: `Check birth dates or reverse relationship direction`,
              code: 'TEACHER_YOUNGER_THAN_STUDENT'
            });
          }
        }
      }

      // Incarnation checks
      if (relationship.predicate === 'incarnation_of' && object.type === 'person') {
        const laterBirth = birthDate;
        const earlierDeath = object.dates?.death;

        if (laterBirth && earlierDeath) {
          // Later incarnation should be born after (or very close to) earlier incarnation's death
          const yearDiff = this.getYearValue(laterBirth) - this.getYearValue(earlierDeath);

          if (yearDiff < -1) {
            issues.push({
              severity: 'error',
              category: 'temporal',
              message: `Incarnation timeline invalid: ${subject.canonicalName} born before previous incarnation ${object.canonicalName} died`,
              affectedEntities: [subject.id, object.id],
              suggestion: `Check dates or relationship direction`,
              code: 'INVALID_INCARNATION_TIMELINE'
            });
          }

          if (yearDiff > 50) {
            issues.push({
              severity: 'warning',
              category: 'temporal',
              message: `Large gap (${yearDiff} years) between incarnations`,
              affectedEntities: [subject.id, object.id],
              suggestion: `Verify this is correct or if there are missing intermediate incarnations`,
              code: 'LARGE_INCARNATION_GAP'
            });
          }
        }
      }
    }

    // Text composition/citation checks
    if (relationship.predicate === 'cites' && subject.type === 'text' && object.type === 'text') {
      const citingDate = subject.dates?.composed;
      const citedDate = object.dates?.composed;

      if (citingDate && citedDate && this.compareYears(citingDate, citedDate) < 0) {
        issues.push({
          severity: 'error',
          category: 'temporal',
          message: `Text ${subject.canonicalName} cites ${object.canonicalName}, but was composed earlier`,
          affectedEntities: [subject.id, object.id],
          suggestion: `Check composition dates or citation relationship`,
          code: 'CITES_FUTURE_TEXT'
        });
      }
    }

    // Commentary must be written after root text
    if (relationship.predicate === 'commentary_on' && subject.type === 'text' && object.type === 'text') {
      const commentaryDate = subject.dates?.composed;
      const rootTextDate = object.dates?.composed;

      if (commentaryDate && rootTextDate && this.compareYears(commentaryDate, rootTextDate) < 0) {
        issues.push({
          severity: 'error',
          category: 'temporal',
          message: `Commentary ${subject.canonicalName} written before root text ${object.canonicalName}`,
          affectedEntities: [subject.id, object.id],
          suggestion: `Check composition dates`,
          code: 'COMMENTARY_BEFORE_ROOT_TEXT'
        });
      }
    }

    return issues;
  }

  /**
   * Check logical constraints
   */
  checkLogicalConstraints(
    relationship: Relationship,
    allRelationships: Relationship[]
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // No self-relationships
    if (relationship.subjectId === relationship.objectId) {
      issues.push({
        severity: 'error',
        category: 'logical',
        message: `Self-relationship detected: entity cannot have relationship with itself`,
        affectedEntities: [relationship.subjectId],
        suggestion: `Remove this relationship`,
        code: 'SELF_RELATIONSHIP'
      });
    }

    // Check for circular relationships
    const cycles = this.detectCycles(allRelationships, relationship.predicate);
    for (const cycle of cycles) {
      if (cycle.entityIds.includes(relationship.subjectId) || cycle.entityIds.includes(relationship.objectId)) {
        issues.push({
          severity: 'error',
          category: 'logical',
          message: `Circular relationship detected: ${cycle.description}`,
          affectedEntities: cycle.entityIds,
          suggestion: `Review and break the cycle`,
          code: 'CIRCULAR_RELATIONSHIP'
        });
      }
    }

    return issues;
  }

  /**
   * Check cross-references and bidirectional relationships
   */
  checkCrossReferences(
    relationship: Relationship,
    entities: Map<string, Entity>,
    allRelationships: Relationship[]
  ): { warnings: ValidationWarning[]; suggestions: Correction[] } {
    const warnings: ValidationWarning[] = [];
    const suggestions: Correction[] = [];

    const inversePredicate = BIDIRECTIONAL_PAIRS[relationship.predicate];

    if (inversePredicate) {
      // Check if inverse relationship exists
      const inverseExists = allRelationships.some(r =>
        r.subjectId === relationship.objectId &&
        r.objectId === relationship.subjectId &&
        r.predicate === inversePredicate
      );

      if (!inverseExists) {
        warnings.push({
          severity: 'warning',
          category: 'reference',
          message: `Bidirectional relationship missing: expected inverse relationship (${inversePredicate})`,
          affectedEntities: [relationship.subjectId, relationship.objectId],
          suggestion: `Create inverse relationship: ${inversePredicate}`,
          code: 'MISSING_INVERSE_RELATIONSHIP',
          autoFixable: true
        });

        suggestions.push({
          type: 'add_relationship',
          description: `Add inverse relationship: ${entities.get(relationship.objectId)?.canonicalName} ${inversePredicate} ${entities.get(relationship.subjectId)?.canonicalName}`,
          affectedEntities: [relationship.objectId, relationship.subjectId],
          confidence: 0.95,
          autoApply: true
        });
      }
    }

    return { warnings, suggestions };
  }

  /**
   * Detect cycles in relationship graph
   */
  detectCycles(
    relationships: Relationship[],
    predicateType: PredicateType
  ): Cycle[] {
    const cycles: Cycle[] = [];
    const graph = new Map<string, Set<string>>();

    // Build adjacency graph for this predicate type
    relationships
      .filter(r => r.predicate === predicateType)
      .forEach(r => {
        if (!graph.has(r.subjectId)) {
          graph.set(r.subjectId, new Set());
        }
        graph.get(r.subjectId)!.add(r.objectId);
      });

    // DFS to detect cycles
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = graph.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recStack.has(neighbor)) {
          // Cycle detected
          const cycleStart = path.indexOf(neighbor);
          const cyclePath = path.slice(cycleStart);
          cycles.push({
            predicate: predicateType,
            entityIds: cyclePath,
            description: `Cycle in ${predicateType}: ${cyclePath.join(' → ')}`
          });
        }
      }

      recStack.delete(nodeId);
    };

    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  /**
   * Suggest corrections for validation issues
   */
  suggestCorrections(
    issue: ValidationIssue,
    relationship: Relationship,
    subject: Entity,
    object: Entity
  ): Correction[] {
    const corrections: Correction[] = [];

    switch (issue.code) {
      case 'ACTION_BEFORE_BIRTH':
      case 'ACTION_AFTER_DEATH':
        corrections.push({
          type: 'modify_date',
          description: `Review and correct ${issue.code === 'ACTION_BEFORE_BIRTH' ? 'birth' : 'death'} date or event date`,
          affectedEntities: [subject.id],
          confidence: 0.5,
          autoApply: false
        });
        corrections.push({
          type: 'mark_disputed',
          description: `Mark date as 'disputed' if sources conflict`,
          affectedEntities: [subject.id],
          confidence: 0.7,
          autoApply: false
        });
        break;

      case 'TEACHER_YOUNGER_THAN_STUDENT':
        corrections.push({
          type: 'modify_date',
          description: `Check birth dates for ${subject.canonicalName} and ${object.canonicalName}`,
          affectedEntities: [subject.id, object.id],
          confidence: 0.6,
          autoApply: false
        });
        break;

      case 'MISSING_INVERSE_RELATIONSHIP':
        corrections.push({
          type: 'add_relationship',
          description: `Create inverse relationship`,
          affectedEntities: [relationship.objectId, relationship.subjectId],
          confidence: 0.95,
          autoApply: true
        });
        break;

      case 'SELF_RELATIONSHIP':
        corrections.push({
          type: 'remove_relationship',
          description: `Remove invalid self-relationship`,
          affectedEntities: [relationship.subjectId],
          confidence: 1.0,
          autoApply: true
        });
        break;

      case 'CIRCULAR_RELATIONSHIP':
        corrections.push({
          type: 'remove_relationship',
          description: `Review and remove one relationship in the cycle`,
          affectedEntities: issue.affectedEntities,
          confidence: 0.5,
          autoApply: false
        });
        break;
    }

    return corrections;
  }

  /**
   * Adjust confidence based on validation issues
   */
  adjustConfidence(
    originalConfidence: number,
    issues: ValidationIssue[],
    warnings: ValidationWarning[]
  ): number {
    let confidence = originalConfidence;

    // Type errors make relationship invalid
    const typeErrors = issues.filter(i => i.severity === 'error' && i.category === 'type');
    if (typeErrors.length > 0) {
      return 0.0;
    }

    // Temporal errors significantly reduce confidence
    const temporalErrors = issues.filter(i => i.severity === 'error' && i.category === 'temporal');
    confidence *= Math.pow(0.5, temporalErrors.length);

    // Logical errors significantly reduce confidence
    const logicalErrors = issues.filter(i => i.severity === 'error' && i.category === 'logical');
    confidence *= Math.pow(0.3, logicalErrors.length);

    // Warnings moderately reduce confidence
    confidence *= Math.pow(0.85, warnings.length);

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Validate all relationships in a batch
   */
  validateAllRelationships(
    relationships: Relationship[],
    entities: Map<string, Entity>
  ): BatchValidationReport {
    const results = relationships.map(r =>
      this.validateRelationship(r, entities, relationships)
    );

    const issuesByCategory: Record<string, number> = {};
    const issueBySeverity: Record<string, number> = {};
    const allIssues: ValidationIssue[] = [];

    for (const result of results) {
      for (const issue of result.issues) {
        allIssues.push(issue);
        issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
        issueBySeverity[issue.severity] = (issueBySeverity[issue.severity] || 0) + 1;
      }
    }

    // Detect systematic issues
    const systematicIssues = this.detectSystematicIssues(allIssues, relationships);

    // Generate recommendations
    const recommendations = this.generateRecommendations(results, systematicIssues);

    return {
      totalRelationships: relationships.length,
      validRelationships: results.filter(r => r.valid).length,
      invalidRelationships: results.filter(r => !r.valid).length,
      totalIssues: allIssues.length,
      issuesByCategory,
      issueBySeverity,
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      systematicIssues,
      recommendations
    };
  }

  /**
   * Detect systematic issues across multiple relationships
   */
  private detectSystematicIssues(
    issues: ValidationIssue[],
    relationships: Relationship[]
  ): SystematicIssue[] {
    const systematicIssues: SystematicIssue[] = [];
    const issuesByCode = new Map<string, ValidationIssue[]>();

    // Group issues by code
    for (const issue of issues) {
      if (issue.code) {
        if (!issuesByCode.has(issue.code)) {
          issuesByCode.set(issue.code, []);
        }
        issuesByCode.get(issue.code)!.push(issue);
      }
    }

    // Identify patterns that occur frequently (>5 times)
    for (const [code, codeIssues] of issuesByCode) {
      if (codeIssues.length >= 5) {
        systematicIssues.push({
          pattern: code,
          occurrences: codeIssues.length,
          affectedRelationships: codeIssues
            .flatMap(i => i.affectedEntities)
            .filter((v, i, a) => a.indexOf(v) === i), // unique
          suggestedFix: codeIssues[0].suggestion || 'Review all instances'
        });
      }
    }

    return systematicIssues;
  }

  /**
   * Generate recommendations for batch validation
   */
  private generateRecommendations(
    results: ValidationResult[],
    systematicIssues: SystematicIssue[]
  ): string[] {
    const recommendations: string[] = [];

    const errorRate = results.filter(r => !r.valid).length / results.length;
    if (errorRate > 0.2) {
      recommendations.push(`High error rate (${(errorRate * 100).toFixed(1)}%). Review extraction prompts and patterns.`);
    }

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    if (avgConfidence < 0.6) {
      recommendations.push(`Low average confidence (${avgConfidence.toFixed(2)}). Consider requiring human review for low-confidence relationships.`);
    }

    for (const issue of systematicIssues) {
      recommendations.push(`Systematic issue detected: ${issue.pattern} (${issue.occurrences} occurrences). ${issue.suggestedFix}`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Validation quality looks good. Continue monitoring for edge cases.');
    }

    return recommendations;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private compareYears(date1: DateInfo, date2: DateInfo): number {
    const year1 = this.getYearValue(date1);
    const year2 = this.getYearValue(date2);
    return year1 - year2;
  }

  private getYearValue(date: DateInfo): number {
    if (date.year) return date.year;
    if (date.tibetanYear) {
      // Convert Tibetan year to approximate Gregorian
      // Simplified conversion (more accurate would use actual rabjung start dates)
      return 1027 + (date.tibetanYear.rabjung - 1) * 60 + date.tibetanYear.year - 1;
    }
    return 0;
  }

  private formatYear(date: DateInfo): string {
    if (date.year) {
      return `${date.year} ${date.precision !== 'exact' ? `(${date.precision})` : ''}`.trim();
    }
    if (date.tibetanYear) {
      return `Rabjung ${date.tibetanYear.rabjung}, Year ${date.tibetanYear.year}`;
    }
    return 'unknown date';
  }
}

// Export singleton instance
export const relationshipValidator = new RelationshipValidator();
