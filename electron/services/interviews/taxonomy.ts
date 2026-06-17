export interface InterviewTaxonomyEntry {
  sourceHeading: string;
  target: string;
  status: 'mapped' | 'deferred';
  rationale: string;
}

export const INTERVIEW_TAXONOMY: InterviewTaxonomyEntry[] = [
  {
    sourceHeading: 'pre-interview goal',
    target: 'prep_briefs.one_line_goal',
    status: 'mapped',
    rationale: 'Single sharp outcome for the next interview.',
  },
  {
    sourceHeading: 'pitches',
    target: 'prep_briefs.pitch_30s, prep_briefs.pitch_2m',
    status: 'mapped',
    rationale: 'Keeps short and longer spoken intros exportable.',
  },
  {
    sourceHeading: 'role fit',
    target: 'vacancy_dossiers.fit_hypothesis',
    status: 'mapped',
    rationale: 'Stores the user-authored match thesis for the role.',
  },
  {
    sourceHeading: 'stories',
    target: 'prep_briefs.cheatsheet',
    status: 'mapped',
    rationale: 'P1 stores narrative prep in the cheat sheet body until story cards are warranted.',
  },
  {
    sourceHeading: 'questions to ask',
    target: 'vacancy_dossiers.questions_to_ask_json',
    status: 'mapped',
    rationale: 'First-class structured list for pre-interview questions.',
  },
  {
    sourceHeading: 'risk handling',
    target: 'prep_briefs.risk_handling_json, vacancy_dossiers.risks_json',
    status: 'mapped',
    rationale: 'Separates known role risks from prepared responses.',
  },
  {
    sourceHeading: 'last checklist',
    target: 'prep_briefs.last_checklist_json',
    status: 'mapped',
    rationale: 'Supports readiness rules and final pre-call checks.',
  },
  {
    sourceHeading: 'post-interview summary',
    target: 'interview_retros.main_signal',
    status: 'mapped',
    rationale: 'Concise retro signal for the process.',
  },
  {
    sourceHeading: 'questions asked',
    target: 'interview_questions.question_text',
    status: 'mapped',
    rationale: 'Turns retros into a reusable question bank.',
  },
  {
    sourceHeading: 'strong moments',
    target: 'interview_retros.strong_moments_json',
    status: 'mapped',
    rationale: 'Structured retro wins.',
  },
  {
    sourceHeading: 'weak moments',
    target: 'interview_retros.weak_moments_json',
    status: 'mapped',
    rationale: 'Structured weak spots for next prep.',
  },
  {
    sourceHeading: 'new facts',
    target: 'interview_retros.new_facts_json',
    status: 'mapped',
    rationale: 'Captures company/process facts learned after the call.',
  },
  {
    sourceHeading: 'follow-up actions',
    target: 'interview_retros.follow_up_actions_json',
    status: 'mapped',
    rationale: 'Turns retros into concrete next actions.',
  },
  {
    sourceHeading: 'next prep',
    target: 'prep_briefs.last_checklist_json',
    status: 'mapped',
    rationale: 'Next prep tasks are checklist items in P1.',
  },
  {
    sourceHeading: 'stage metadata',
    target: 'interview_events.stage, interview_events.status',
    status: 'mapped',
    rationale: 'Core event/process state.',
  },
  {
    sourceHeading: 'expected focus',
    target: 'prep_briefs.expected_topics_json',
    status: 'mapped',
    rationale: 'Structured expected interview topics.',
  },
  {
    sourceHeading: 'signals',
    target: 'interview_retros.main_signal, interview_retros.pass_probability',
    status: 'mapped',
    rationale: 'Post-call process signal.',
  },
  {
    sourceHeading: 'result',
    target: 'interview_events.status',
    status: 'mapped',
    rationale: 'Result is represented by process status.',
  },
  {
    sourceHeading: 'vacancy intake',
    target: 'interview_events.raw_source_text, vacancy_dossiers.description',
    status: 'mapped',
    rationale: 'Stores raw intake and normalized vacancy body.',
  },
  {
    sourceHeading: 'requirements',
    target: 'vacancy_dossiers.requirements_json',
    status: 'mapped',
    rationale: 'Structured requirements list.',
  },
  {
    sourceHeading: 'evidence match',
    target: 'vacancy_dossiers.fit_hypothesis',
    status: 'mapped',
    rationale: 'P1 stores evidence fit as authored text.',
  },
  {
    sourceHeading: 'hard gaps',
    target: 'vacancy_dossiers.risks_json',
    status: 'mapped',
    rationale: 'Hard gaps are treated as role risks in P1.',
  },
  {
    sourceHeading: 'ATS check',
    target: 'P2 resume variants / ATS scoring',
    status: 'deferred',
    rationale: 'Explicitly out of P1; schema keeps vacancy context for future resume work.',
  },
  {
    sourceHeading: 'resume edits',
    target: 'P2 resume variants / Markdown export',
    status: 'deferred',
    rationale: 'Explicitly out of P1 to avoid changing resume automation scope.',
  },
  {
    sourceHeading: 'readiness/checklist',
    target: 'prep_briefs.last_checklist_json, readiness rules',
    status: 'mapped',
    rationale: 'Checklist feeds deterministic readiness.',
  },
  {
    sourceHeading: 'next-action semantics',
    target: 'readiness.nextAction, interview_retros.follow_up_actions_json',
    status: 'mapped',
    rationale: 'Next action is computed for prep and captured after retros.',
  },
];

export function findTaxonomyEntry(sourceHeading: string): InterviewTaxonomyEntry | undefined {
  const normalized = sourceHeading.trim().toLowerCase();
  return INTERVIEW_TAXONOMY.find(entry => entry.sourceHeading.toLowerCase() === normalized);
}
