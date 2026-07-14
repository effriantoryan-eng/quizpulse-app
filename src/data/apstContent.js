// APST/VIT evidence content for the v4.1.0 Evidence export feature — static data only, no
// logic, no side effects. Text is verbatim from AITSL (descriptors) and DET (VTLM 2.0 wording)
// per QuizPulse_VIT_Export_Research_Brief.docx Parts I, III, IV — do not paraphrase. Reviewed
// separately from code review before v4.1.0-rc1 is tagged.

// The 18 of 37 APST descriptors QuizPulse can evidence (10 Strong + 8 Moderate), Proficient
// level text shown to teachers per the brief's Part IV spec — Graduate text kept alongside for
// completeness. domain matches the three APST domains used in the coverage check.
export const APST_DESCRIPTORS = [
  {
    id: '1.1',
    focusArea: 'Physical, social and intellectual development and characteristics of students',
    domain: 'Professional Knowledge',
    graduate: 'Demonstrate knowledge and understanding of physical, social and intellectual development and characteristics of students and how these may affect learning.',
    proficient: "Use teaching strategies based on knowledge of students' physical, social and intellectual development and characteristics to improve student learning.",
  },
  {
    id: '1.2',
    focusArea: 'Understand how students learn',
    domain: 'Professional Knowledge',
    graduate: 'Demonstrate knowledge and understanding of research into how students learn and the implications for teaching.',
    proficient: 'Structure teaching programs using research and collegial advice about how students learn.',
  },
  {
    id: '1.5',
    focusArea: 'Differentiate teaching to meet the specific learning needs of students across the full range of abilities',
    domain: 'Professional Knowledge',
    graduate: 'Demonstrate knowledge and understanding of strategies for differentiating teaching to meet the specific learning needs of students across the full range of abilities.',
    proficient: 'Develop teaching activities that incorporate differentiated strategies to meet the specific learning needs of students across the full range of abilities.',
  },
  {
    id: '2.1',
    focusArea: 'Content and teaching strategies of the teaching area',
    domain: 'Professional Knowledge',
    graduate: 'Demonstrate knowledge and understanding of the concepts, substance and structure of the content and teaching strategies of the teaching area.',
    proficient: 'Apply knowledge of the content and teaching strategies of the teaching area to develop engaging teaching activities.',
  },
  {
    id: '2.2',
    focusArea: 'Content selection and organisation',
    domain: 'Professional Knowledge',
    graduate: 'Organise content into an effective learning and teaching sequence.',
    proficient: 'Organise content into coherent, well-sequenced learning and teaching programs.',
  },
  {
    id: '2.3',
    focusArea: 'Curriculum, assessment and reporting',
    domain: 'Professional Knowledge',
    graduate: 'Use curriculum, assessment and reporting knowledge to design learning sequences and lesson plans.',
    proficient: 'Design and implement learning and teaching programs using knowledge of curriculum, assessment and reporting requirements.',
  },
  {
    id: '2.6',
    focusArea: 'Information and Communication Technology (ICT)',
    domain: 'Professional Knowledge',
    graduate: 'Implement teaching strategies for using ICT to expand curriculum learning opportunities for students.',
    proficient: 'Use effective teaching strategies to integrate ICT into learning and teaching programs to make selected content relevant and meaningful.',
  },
  {
    id: '3.2',
    focusArea: 'Plan, structure and sequence learning programs',
    domain: 'Professional Practice',
    graduate: 'Plan lesson sequences using knowledge of student learning, content and effective teaching strategies.',
    proficient: 'Plan and implement well-structured learning and teaching programs or lesson sequences that engage students and promote learning.',
  },
  {
    id: '3.3',
    focusArea: 'Use teaching strategies',
    domain: 'Professional Practice',
    graduate: 'Include a range of teaching strategies.',
    proficient: 'Select and use relevant teaching strategies to develop knowledge, skills, problem solving and critical and creative thinking.',
  },
  {
    id: '3.4',
    focusArea: 'Select and use resources',
    domain: 'Professional Practice',
    graduate: 'Demonstrate knowledge of a range of resources, including ICT, that engage students in their learning.',
    proficient: 'Select and/or create and use a range of resources, including ICT, to engage students in their learning.',
  },
  {
    id: '3.6',
    focusArea: 'Evaluate and improve teaching programs',
    domain: 'Professional Practice',
    graduate: 'Demonstrate broad knowledge of strategies that can be used to evaluate teaching programs to improve student learning.',
    proficient: 'Evaluate personal teaching and learning programs using evidence, including feedback from students and student assessment data, to inform planning.',
  },
  {
    id: '4.5',
    focusArea: 'Use ICT safely, responsibly and ethically',
    domain: 'Professional Practice',
    graduate: 'Demonstrate an understanding of the relevant issues and the strategies available to support the safe, responsible and ethical use of ICT in learning and teaching.',
    proficient: 'Incorporate strategies to promote the safe, responsible and ethical use of ICT in learning and teaching.',
  },
  {
    id: '5.1',
    focusArea: 'Assess student learning',
    domain: 'Professional Practice',
    graduate: 'Demonstrate understanding of assessment strategies, including informal and formal, diagnostic, formative and summative approaches to assess student learning.',
    proficient: 'Develop, select and use informal and formal, diagnostic, formative and summative assessment strategies to assess student learning.',
  },
  {
    id: '5.2',
    focusArea: 'Provide feedback to students on their learning',
    domain: 'Professional Practice',
    graduate: 'Demonstrate an understanding of the purpose of providing timely and appropriate feedback to students about their learning.',
    proficient: 'Provide timely, effective and appropriate feedback to students about their achievement relative to their learning goals.',
  },
  {
    id: '5.4',
    focusArea: 'Interpret student data',
    domain: 'Professional Practice',
    graduate: 'Demonstrate the capacity to interpret student assessment data to evaluate student learning and modify teaching practice.',
    proficient: 'Use student assessment data to analyse and evaluate student understanding of subject/content, identifying interventions and modifying teaching practice.',
  },
  {
    id: '6.1',
    focusArea: 'Identify and plan professional learning needs',
    domain: 'Professional Engagement',
    graduate: 'Demonstrate an understanding of the role of the Australian Professional Standards for Teachers in identifying professional learning needs.',
    proficient: 'Use the Australian Professional Standards for Teachers and advice from colleagues to identify and plan professional learning needs.',
  },
  {
    id: '6.2',
    focusArea: 'Engage in professional learning and improve practice',
    domain: 'Professional Engagement',
    graduate: 'Understand the relevant and appropriate sources of professional learning for teachers.',
    proficient: 'Participate in learning to update knowledge and practice, targeted to professional needs and school and/or system priorities.',
  },
  {
    id: '6.4',
    focusArea: 'Apply professional learning and improve student learning',
    domain: 'Professional Engagement',
    graduate: 'Demonstrate an understanding of the rationale for continued professional learning and the implications for improved student learning.',
    proficient: 'Undertake professional learning programs designed to address identified student learning needs.',
  },
]

// Pre-ticked defaults on the per-activity export screen — per the research brief's MyPD field
// table ("Pre-tick: 3.3, 3.6, 5.1, 5.4, 6.2 as defaults").
export const APST_DEFAULTS = ['3.3', '3.6', '5.1', '5.4', '6.2']

// Verbatim DET VTLM 2.0 alignment text, pre-populated read-only on Screen 1.
export const VTLM_ALIGNMENT = 'Supported Application — Revisit and review; Explicit Teaching — Monitor progress'

// Verbatim reflection templates (Part IV.C of the research brief). [PERSONALISE: ...] gaps must
// stay literal in the string — the export endpoint rejects a submission that still contains them.
export const REFLECTION_TEMPLATE_1 =
  "In [Term/Date range], I implemented retrieval practice quizzing using QuizPulse to improve my formative assessment practice. This activity is grounded in evidence from AERO's Spacing and Retrieval Practice guide (2021) and aligns with VTLM 2.0 Supported Application — specifically the Revisit and review strategy, which develops students' retention and recall of key knowledge. Reviewing the QuizPulse analytics data, I learnt that [PERSONALISE: what the data revealed about student understanding — e.g., a specific misconception pattern, or which topics had the strongest vs weakest recall]. This deepened my understanding of APST 5.4 (interpreting student data to identify interventions) and APST 3.6 (evaluating teaching programs using evidence). It also reinforced my application of APST 3.3 (selecting a named, evidence-based teaching strategy aligned to VTLM 2.0)."

export const REFLECTION_TEMPLATE_2 =
  'In response to the QuizPulse data, I will [PERSONALISE: describe one specific teaching adjustment — e.g., reteach Newton\'s Second Law using additional worked examples before the next quiz; introduce more frequent spacing on the topic area where confident-but-wrong responses were highest]. I will continue using QuizPulse for at least [N] more quiz cycles to track whether this adjustment improves the correctness trend for the identified misconception. This reflects my implementation of APST 6.4 (undertaking PL designed to address identified student learning needs) and APST 5.4 (modifying teaching practice in response to assessment data).'

export const AERO_CITATIONS = [
  'AERO Spacing and Retrieval Practice guide (2021)',
  'AERO Revisit and review guide (2024)',
]

// Footer text required on every exported PDF page, both endpoints — verbatim per the research
// brief's Part IV.D non-negotiables.
export const EXPORT_FOOTER_TEMPLATE = (dateStr) =>
  `Generated by QuizPulse ${dateStr}. For VIT professional learning evidence purposes only. Analytics are cohort-level; no individual student data is included.`
