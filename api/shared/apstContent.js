// Server-side mirror of src/data/apstContent.js (CommonJS — the API is a separate Node module
// and can't import the frontend's ESM data file). Keep both in sync if the content changes;
// verbatim-accuracy against AITSL/DET source is reviewed on both together before v4.1.0-rc1.

const APST_DESCRIPTORS = [
  { id: '1.1', focusArea: 'Physical, social and intellectual development and characteristics of students', domain: 'Professional Knowledge', graduate: 'Demonstrate knowledge and understanding of physical, social and intellectual development and characteristics of students and how these may affect learning.', proficient: "Use teaching strategies based on knowledge of students' physical, social and intellectual development and characteristics to improve student learning." },
  { id: '1.2', focusArea: 'Understand how students learn', domain: 'Professional Knowledge', graduate: 'Demonstrate knowledge and understanding of research into how students learn and the implications for teaching.', proficient: 'Structure teaching programs using research and collegial advice about how students learn.' },
  { id: '1.5', focusArea: 'Differentiate teaching to meet the specific learning needs of students across the full range of abilities', domain: 'Professional Knowledge', graduate: 'Demonstrate knowledge and understanding of strategies for differentiating teaching to meet the specific learning needs of students across the full range of abilities.', proficient: 'Develop teaching activities that incorporate differentiated strategies to meet the specific learning needs of students across the full range of abilities.' },
  { id: '2.1', focusArea: 'Content and teaching strategies of the teaching area', domain: 'Professional Knowledge', graduate: 'Demonstrate knowledge and understanding of the concepts, substance and structure of the content and teaching strategies of the teaching area.', proficient: 'Apply knowledge of the content and teaching strategies of the teaching area to develop engaging teaching activities.' },
  { id: '2.2', focusArea: 'Content selection and organisation', domain: 'Professional Knowledge', graduate: 'Organise content into an effective learning and teaching sequence.', proficient: 'Organise content into coherent, well-sequenced learning and teaching programs.' },
  { id: '2.3', focusArea: 'Curriculum, assessment and reporting', domain: 'Professional Knowledge', graduate: 'Use curriculum, assessment and reporting knowledge to design learning sequences and lesson plans.', proficient: 'Design and implement learning and teaching programs using knowledge of curriculum, assessment and reporting requirements.' },
  { id: '2.6', focusArea: 'Information and Communication Technology (ICT)', domain: 'Professional Knowledge', graduate: 'Implement teaching strategies for using ICT to expand curriculum learning opportunities for students.', proficient: 'Use effective teaching strategies to integrate ICT into learning and teaching programs to make selected content relevant and meaningful.' },
  { id: '3.2', focusArea: 'Plan, structure and sequence learning programs', domain: 'Professional Practice', graduate: 'Plan lesson sequences using knowledge of student learning, content and effective teaching strategies.', proficient: 'Plan and implement well-structured learning and teaching programs or lesson sequences that engage students and promote learning.' },
  { id: '3.3', focusArea: 'Use teaching strategies', domain: 'Professional Practice', graduate: 'Include a range of teaching strategies.', proficient: 'Select and use relevant teaching strategies to develop knowledge, skills, problem solving and critical and creative thinking.' },
  { id: '3.4', focusArea: 'Select and use resources', domain: 'Professional Practice', graduate: 'Demonstrate knowledge of a range of resources, including ICT, that engage students in their learning.', proficient: 'Select and/or create and use a range of resources, including ICT, to engage students in their learning.' },
  { id: '3.6', focusArea: 'Evaluate and improve teaching programs', domain: 'Professional Practice', graduate: 'Demonstrate broad knowledge of strategies that can be used to evaluate teaching programs to improve student learning.', proficient: 'Evaluate personal teaching and learning programs using evidence, including feedback from students and student assessment data, to inform planning.' },
  { id: '4.5', focusArea: 'Use ICT safely, responsibly and ethically', domain: 'Professional Practice', graduate: 'Demonstrate an understanding of the relevant issues and the strategies available to support the safe, responsible and ethical use of ICT in learning and teaching.', proficient: 'Incorporate strategies to promote the safe, responsible and ethical use of ICT in learning and teaching.' },
  { id: '5.1', focusArea: 'Assess student learning', domain: 'Professional Practice', graduate: 'Demonstrate understanding of assessment strategies, including informal and formal, diagnostic, formative and summative approaches to assess student learning.', proficient: 'Develop, select and use informal and formal, diagnostic, formative and summative assessment strategies to assess student learning.' },
  { id: '5.2', focusArea: 'Provide feedback to students on their learning', domain: 'Professional Practice', graduate: 'Demonstrate an understanding of the purpose of providing timely and appropriate feedback to students about their learning.', proficient: 'Provide timely, effective and appropriate feedback to students about their achievement relative to their learning goals.' },
  { id: '5.4', focusArea: 'Interpret student data', domain: 'Professional Practice', graduate: 'Demonstrate the capacity to interpret student assessment data to evaluate student learning and modify teaching practice.', proficient: 'Use student assessment data to analyse and evaluate student understanding of subject/content, identifying interventions and modifying teaching practice.' },
  { id: '6.1', focusArea: 'Identify and plan professional learning needs', domain: 'Professional Engagement', graduate: 'Demonstrate an understanding of the role of the Australian Professional Standards for Teachers in identifying professional learning needs.', proficient: 'Use the Australian Professional Standards for Teachers and advice from colleagues to identify and plan professional learning needs.' },
  { id: '6.2', focusArea: 'Engage in professional learning and improve practice', domain: 'Professional Engagement', graduate: 'Understand the relevant and appropriate sources of professional learning for teachers.', proficient: 'Participate in learning to update knowledge and practice, targeted to professional needs and school and/or system priorities.' },
  { id: '6.4', focusArea: 'Apply professional learning and improve student learning', domain: 'Professional Engagement', graduate: 'Demonstrate an understanding of the rationale for continued professional learning and the implications for improved student learning.', proficient: 'Undertake professional learning programs designed to address identified student learning needs.' },
];

const APST_DEFAULTS = ['3.3', '3.6', '5.1', '5.4', '6.2'];

const VTLM_ALIGNMENT = 'Supported Application — Revisit and review; Explicit Teaching — Monitor progress';

const AERO_CITATIONS = [
  'AERO Spacing and Retrieval Practice guide (2021)',
  'AERO Revisit and review guide (2024)',
];

const PERSONALISE_MARKER = '[PERSONALISE:';

const DOMAINS = ['Professional Knowledge', 'Professional Practice', 'Professional Engagement'];

const descriptorById = new Map(APST_DESCRIPTORS.map(d => [d.id, d]));

// Returns { domain: boolean } coverage for a set of descriptor IDs — used by both the per-activity
// domain-coverage note and the annual log's three-domain confirmation.
function domainCoverage(descriptorIds) {
  const coverage = { 'Professional Knowledge': false, 'Professional Practice': false, 'Professional Engagement': false };
  for (const id of descriptorIds || []) {
    const d = descriptorById.get(id);
    if (d) coverage[d.domain] = true;
  }
  return coverage;
}

module.exports = {
  APST_DESCRIPTORS,
  APST_DEFAULTS,
  VTLM_ALIGNMENT,
  AERO_CITATIONS,
  PERSONALISE_MARKER,
  DOMAINS,
  descriptorById,
  domainCoverage,
};
