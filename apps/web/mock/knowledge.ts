import type { GraphEdge, GraphNode, KnowledgeGraph } from '@/types/knowledge';

/**
 * The knowledge graph, woven from the same entities every other screen reads.
 *
 * Nothing here is invented for the graph's benefit: each node is a person,
 * project, meeting, email, task, or decision that exists elsewhere in the mock
 * organization, and its `entityHref` opens the live surface for it where one has
 * been built. The Atlas story — a supplier slip threatening the Acme renewal —
 * is the same story the dashboard, meetings, and inbox tell; here you can see it
 * as a shape.
 *
 * Article bodies live here too (the list carries only the summary), the same
 * list-plus-detail split as meetings and mail.
 */

const nodes: GraphNode[] = [
  // People — live; each opens their organization profile.
  { id: 'person_amara', kind: 'person', label: 'Amara Osei', sublabel: 'COO', entityHref: '/organization/user_amara' },
  { id: 'person_daniel', kind: 'person', label: 'Daniel Reyes', sublabel: 'VP Engineering', entityHref: '/organization/user_daniel' },
  { id: 'person_lena', kind: 'person', label: 'Lena Fischer', sublabel: 'Head of Legal', entityHref: '/organization/user_lena' },
  { id: 'person_priya', kind: 'person', label: 'Priya Nair', sublabel: 'Director of Product', entityHref: '/organization/user_priya' },

  // Projects — live.
  { id: 'proj_atlas', kind: 'project', label: 'Atlas — Warehouse Fleet v3', sublabel: 'At risk', entityHref: '/projects/proj_atlas' },
  { id: 'proj_meridian', kind: 'project', label: 'Meridian', sublabel: 'On track', entityHref: '/projects/proj_meridian' },
  { id: 'proj_harbor', kind: 'project', label: 'Harbor', sublabel: 'On track', entityHref: '/projects/proj_harbor' },

  // Meetings — live.
  { id: 'meet_atlas_review', kind: 'meeting', label: 'Atlas milestone review', sublabel: 'Upcoming', entityHref: '/meetings/meet_atlas_review' },
  { id: 'meet_acme_qbr', kind: 'meeting', label: 'Acme QBR', sublabel: 'Summarized', entityHref: '/meetings/meet_acme_qbr' },
  { id: 'meet_meridian_design', kind: 'meeting', label: 'Meridian design review', sublabel: 'Summarized', entityHref: '/meetings/meet_meridian_design' },

  // Emails — live.
  { id: 'email_acme_renewal', kind: 'email', label: 'Acme contract renewal', sublabel: 'Marcus Webb', entityHref: '/inbox/email_acme_renewal' },
  { id: 'email_supplier_delay', kind: 'email', label: 'Actuator housing delay', sublabel: 'Precision Parts', entityHref: '/inbox/email_supplier_delay' },
  { id: 'email_soc2', kind: 'email', label: 'SOC 2 evidence request', sublabel: 'Auditor', entityHref: '/inbox/email_soc2' },

  // Tasks — the tasks board is live (no per-task page), so they link to it.
  { id: 'task_revised_timeline', kind: 'task', label: 'Send revised Atlas timeline', sublabel: 'Critical', entityHref: '/tasks' },
  { id: 'task_section8', kind: 'task', label: 'Review Acme contract §8', sublabel: 'High', entityHref: '/tasks' },
  { id: 'task_soc2_evidence', kind: 'task', label: 'Gather SOC 2 evidence', sublabel: 'In progress', entityHref: '/tasks' },

  // Decisions — recorded in the knowledge base, so they open there.
  { id: 'art_atlas_rescope', kind: 'decision', label: 'Atlas rescope decision', sublabel: 'Confidence 88', entityHref: '/knowledge/art_atlas_rescope' },
  { id: 'art_meridian_design', kind: 'decision', label: 'Meridian design outcomes', sublabel: 'Confidence 69', entityHref: '/knowledge/art_meridian_design' },

  // The organization itself.
  { id: 'org_northwind', kind: 'organization', label: 'Northwind Robotics', sublabel: 'Workspace', entityHref: '/organization' },
];

const edges: GraphEdge[] = [
  { id: 'g1', source: 'person_daniel', target: 'proj_atlas', relation: 'leads' },
  { id: 'g2', source: 'person_priya', target: 'proj_meridian', relation: 'leads' },
  { id: 'g3', source: 'person_lena', target: 'proj_harbor', relation: 'leads' },
  { id: 'g4', source: 'proj_atlas', target: 'meet_atlas_review', relation: 'reviewed in' },
  { id: 'g5', source: 'proj_atlas', target: 'meet_acme_qbr', relation: 'discussed in' },
  { id: 'g6', source: 'proj_meridian', target: 'meet_meridian_design', relation: 'reviewed in' },
  { id: 'g7', source: 'meet_atlas_review', target: 'person_amara', relation: 'attended by' },
  { id: 'g8', source: 'meet_atlas_review', target: 'person_daniel', relation: 'attended by' },
  { id: 'g9', source: 'email_acme_renewal', target: 'proj_atlas', relation: 'concerns' },
  { id: 'g10', source: 'email_supplier_delay', target: 'proj_atlas', relation: 'blocks' },
  { id: 'g11', source: 'email_soc2', target: 'proj_harbor', relation: 'concerns' },
  { id: 'g12', source: 'task_revised_timeline', target: 'proj_atlas', relation: 'advances' },
  { id: 'g13', source: 'task_section8', target: 'email_acme_renewal', relation: 'answers' },
  { id: 'g14', source: 'task_soc2_evidence', target: 'email_soc2', relation: 'answers' },
  { id: 'g15', source: 'art_atlas_rescope', target: 'meet_atlas_review', relation: 'decided at' },
  { id: 'g16', source: 'art_atlas_rescope', target: 'email_supplier_delay', relation: 'cites' },
  { id: 'g17', source: 'art_meridian_design', target: 'meet_meridian_design', relation: 'decided at' },
  { id: 'g18', source: 'person_amara', target: 'email_acme_renewal', relation: 'owns' },
  { id: 'g19', source: 'org_northwind', target: 'person_amara', relation: 'led by' },
  { id: 'g20', source: 'org_northwind', target: 'proj_atlas', relation: 'runs' },
];

export const mockKnowledgeGraph: KnowledgeGraph = { nodes, edges };

/**
 * Article bodies and their links back into the graph, keyed by article id.
 * The list view never needs these; getArticle merges them onto the summary.
 */
export const mockArticleBodies: Record<
  string,
  { body: string; relatedNodeIds: string[] }
> = {
  art_atlas_rescope: {
    body:
      'Precision Parts confirmed actuator-housing lead time moving from four to seven weeks, effective immediately. That slip threatens the Atlas milestone-4 date, which Acme has made a condition of their renewal.\n\nTwo options were weighed: extend the deadline, or rescope the housing-dependent work so the remaining milestone-4 scope lands on the original date. Rescoping was chosen — it preserves the customer commitment, keeps the renewal conversation on schedule, and confines the slip to non-critical-path work. The extension option was rejected because no alternate supplier has been priced, so an extension would rest on an unquantified assumption.\n\nOwner: Daniel Reyes. To be confirmed at the Atlas milestone review before the revised date is sent to Acme.',
    relatedNodeIds: ['proj_atlas', 'meet_atlas_review', 'email_supplier_delay', 'email_acme_renewal'],
  },
  art_renewal_policy: {
    body:
      'Renewals above €1M escalate to the account lead 30 days before the decision date. Where a delivery commitment is at risk, the account lead must send a revised, credible timeline before any pricing or discount discussion — a date the customer can take to their own board.\n\nThe policy exists because renewals lost in the last two years were lost on delivery credibility, not price. Leading with a firm date, even a later one, has retained more accounts than leading with a concession.',
    relatedNodeIds: ['email_acme_renewal', 'person_amara'],
  },
  art_supplier_playbook: {
    body:
      'When a supplier lead time moves:\n\n1. Price expedited freight immediately — sometimes the slip is buyable back for less than the cost of rescoping.\n2. If not, test whether rescoping dependent work protects the customer date. Confine the slip to non-critical-path scope.\n3. Only renegotiate the customer date once (1) and (2) are exhausted, and never without a credible alternative already in hand.\n\nThe Atlas housing delay is the current worked example of this playbook.',
    relatedNodeIds: ['proj_atlas', 'email_supplier_delay'],
  },
  art_soc2_readiness: {
    body:
      'The recurring evidence set auditors request, each with a named owner and a source system, kept current between audits. Three items are outstanding ahead of the 22 July deadline; owners are assigned and tracked against the SOC 2 evidence task.',
    relatedNodeIds: ['email_soc2', 'proj_harbor', 'task_soc2_evidence'],
  },
  art_meridian_design: {
    body:
      'The design review settled the sensor-placement approach. Two questions on enclosure tooling remain open, pending a supplier quote expected next week. No decision here blocks the current milestone.',
    relatedNodeIds: ['proj_meridian', 'meet_meridian_design'],
  },
};
