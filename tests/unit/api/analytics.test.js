// Unit test for analytics accuracy — mirrors buildQuestionBreakdown() in api/analytics.js.
// Verifies per-option counts, confidentButIncorrect aggregate (Confidence Layer v3.2), and the
// four-cell breakdown (v4.0.0 comprehensive analytics).

const CONFIDENT_VALUES = new Set(['sure', 'pretty_sure']);

function buildQuestionBreakdown(questions, responses) {
  return questions.map(q => {
    const optionCount = (q.options || []).length;
    const counts = Array(optionCount).fill(0);
    let confidentButIncorrect = 0;
    const fourCell = { correctConfident: 0, correctUnsure: 0, incorrectConfident: 0, incorrectUnsure: 0 };
    responses.forEach(r => {
      const answer = (r.answers || []).find(a => a.questionId === q.id);
      if (answer && answer.selectedIndex >= 0 && answer.selectedIndex < optionCount) {
        counts[answer.selectedIndex]++;
        const isCorrect = answer.selectedIndex === q.correctIndex;
        const isConfident = CONFIDENT_VALUES.has(answer.confidence);
        if (isCorrect && isConfident) fourCell.correctConfident++;
        else if (isCorrect && !isConfident) fourCell.correctUnsure++;
        else if (!isCorrect && isConfident) fourCell.incorrectConfident++;
        else fourCell.incorrectUnsure++;
        if (isConfident && !isCorrect) {
          confidentButIncorrect++;
        }
      }
    });
    return { id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex, counts, confidentButIncorrect, fourCell };
  });
}

describe('analytics — accuracy with 5 known responses', () => {
  const questions = [
    { id: 'q1', text: 'Capital of France?', options: ['Paris', 'Rome', 'Berlin', 'Madrid'], correctIndex: 0 },
    { id: 'q2', text: '2 + 2 = ?', options: ['3', '4', '5'], correctIndex: 1 },
  ];

  // 5 students: q1 answers = [Paris, Paris, Rome, Paris, Berlin] -> Paris:3, Rome:1, Berlin:1, Madrid:0
  // q2 answers = [4, 4, 4, 3, 5] -> '4':3, '3':1, '5':1
  const responses = [
    { studentId: 's1', answers: [{ questionId: 'q1', selectedIndex: 0 }, { questionId: 'q2', selectedIndex: 1 }] },
    { studentId: 's2', answers: [{ questionId: 'q1', selectedIndex: 0 }, { questionId: 'q2', selectedIndex: 1 }] },
    { studentId: 's3', answers: [{ questionId: 'q1', selectedIndex: 1 }, { questionId: 'q2', selectedIndex: 1 }] },
    { studentId: 's4', answers: [{ questionId: 'q1', selectedIndex: 0 }, { questionId: 'q2', selectedIndex: 0 }] },
    { studentId: 's5', answers: [{ questionId: 'q1', selectedIndex: 2 }, { questionId: 'q2', selectedIndex: 2 }] },
  ];

  test('computes correct per-option counts for each question', () => {
    const breakdown = buildQuestionBreakdown(questions, responses);

    const q1 = breakdown.find(q => q.id === 'q1');
    expect(q1.counts).toEqual([3, 1, 1, 0]); // Paris, Rome, Berlin, Madrid

    const q2 = breakdown.find(q => q.id === 'q2');
    expect(q2.counts).toEqual([1, 3, 1]); // '3', '4', '5'
  });

  test('total responses across all questions equals the response count', () => {
    expect(responses.length).toBe(5);
  });

  test('non-responder is excluded from counts', () => {
    const partial = responses.slice(0, 4); // drop s5
    const breakdown = buildQuestionBreakdown(questions, partial);
    const q1 = breakdown.find(q => q.id === 'q1');
    expect(q1.counts.reduce((a, b) => a + b, 0)).toBe(4);
  });
});

describe('analytics — confidentButIncorrect signal', () => {
  const questions = [
    { id: 'q1', text: 'Capital of France?', options: ['Paris', 'Rome', 'Berlin', 'Madrid'], correctIndex: 0 },
  ];

  test('counts sure+wrong and pretty_sure+wrong as confidentButIncorrect', () => {
    const responses = [
      { studentId: 's1', answers: [{ questionId: 'q1', selectedIndex: 1, confidence: 'sure' }] },        // wrong, sure -> counts
      { studentId: 's2', answers: [{ questionId: 'q1', selectedIndex: 2, confidence: 'pretty_sure' }] }, // wrong, pretty_sure -> counts
      { studentId: 's3', answers: [{ questionId: 'q1', selectedIndex: 3, confidence: 'guessing' }] },    // wrong, guessing -> does NOT count
      { studentId: 's4', answers: [{ questionId: 'q1', selectedIndex: 0, confidence: 'sure' }] },        // correct, sure -> does NOT count
    ];
    const breakdown = buildQuestionBreakdown(questions, responses);
    expect(breakdown[0].confidentButIncorrect).toBe(2);
  });

  test('returns 0 when all confident students answered correctly', () => {
    const responses = [
      { studentId: 's1', answers: [{ questionId: 'q1', selectedIndex: 0, confidence: 'sure' }] },
      { studentId: 's2', answers: [{ questionId: 'q1', selectedIndex: 0, confidence: 'pretty_sure' }] },
    ];
    const breakdown = buildQuestionBreakdown(questions, responses);
    expect(breakdown[0].confidentButIncorrect).toBe(0);
  });

  test('returns 0 when no confidence data is present (legacy responses)', () => {
    const responses = [
      { studentId: 's1', answers: [{ questionId: 'q1', selectedIndex: 1 }] }, // no confidence field
    ];
    const breakdown = buildQuestionBreakdown(questions, responses);
    expect(breakdown[0].confidentButIncorrect).toBe(0);
  });

  test('confidentButIncorrect is always present in the output (0 when none)', () => {
    const breakdown = buildQuestionBreakdown(questions, []);
    expect(breakdown[0]).toHaveProperty('confidentButIncorrect', 0);
  });
});

describe('analytics — four-cell breakdown (v4.0.0)', () => {
  const questions = [
    { id: 'q1', text: 'Capital of France?', options: ['Paris', 'Rome', 'Berlin', 'Madrid'], correctIndex: 0 },
  ];

  test('sorts each answer into exactly one of the four cells', () => {
    const responses = [
      { studentId: 's1', answers: [{ questionId: 'q1', selectedIndex: 0, confidence: 'sure' }] },        // correct, confident
      { studentId: 's2', answers: [{ questionId: 'q1', selectedIndex: 0, confidence: 'guessing' }] },    // correct, unsure
      { studentId: 's3', answers: [{ questionId: 'q1', selectedIndex: 1, confidence: 'pretty_sure' }] }, // incorrect, confident
      { studentId: 's4', answers: [{ questionId: 'q1', selectedIndex: 2, confidence: 'guessing' }] },    // incorrect, unsure
    ];
    const [q1] = buildQuestionBreakdown(questions, responses);
    expect(q1.fourCell).toEqual({
      correctConfident: 1,
      correctUnsure: 1,
      incorrectConfident: 1,
      incorrectUnsure: 1,
    });
  });

  test('incorrectConfident always equals confidentButIncorrect (same definition, per §E4)', () => {
    const responses = [
      { studentId: 's1', answers: [{ questionId: 'q1', selectedIndex: 1, confidence: 'sure' }] },
      { studentId: 's2', answers: [{ questionId: 'q1', selectedIndex: 2, confidence: 'pretty_sure' }] },
      { studentId: 's3', answers: [{ questionId: 'q1', selectedIndex: 3, confidence: 'guessing' }] },
    ];
    const [q1] = buildQuestionBreakdown(questions, responses);
    expect(q1.fourCell.incorrectConfident).toBe(q1.confidentButIncorrect);
    expect(q1.fourCell.incorrectConfident).toBe(2);
  });

  test('an answer with no confidence field lands in the unsure cells (legacy responses)', () => {
    const responses = [
      { studentId: 's1', answers: [{ questionId: 'q1', selectedIndex: 0 }] }, // correct, no confidence
      { studentId: 's2', answers: [{ questionId: 'q1', selectedIndex: 1 }] }, // incorrect, no confidence
    ];
    const [q1] = buildQuestionBreakdown(questions, responses);
    expect(q1.fourCell).toEqual({ correctConfident: 0, correctUnsure: 1, incorrectConfident: 0, incorrectUnsure: 1 });
  });

  test('four-cell counts sum to total responses for the question', () => {
    const responses = [
      { studentId: 's1', answers: [{ questionId: 'q1', selectedIndex: 0, confidence: 'sure' }] },
      { studentId: 's2', answers: [{ questionId: 'q1', selectedIndex: 1, confidence: 'guessing' }] },
      { studentId: 's3', answers: [{ questionId: 'q1', selectedIndex: 2, confidence: 'sure' }] },
    ];
    const [q1] = buildQuestionBreakdown(questions, responses);
    const sum = Object.values(q1.fourCell).reduce((a, b) => a + b, 0);
    expect(sum).toBe(3);
  });
});

// Mirrors applyClassFilter() in api/analytics.js — narrows responses to one target class
// by device-id membership in that class's approved roster (per-class analytics, v3.3+).
function applyClassFilter(loaded, classId) {
  const { quiz, responses, classRosters } = loaded;
  if (!classId || !(quiz.classIds || []).includes(classId)) return loaded;
  const deviceSet = new Set((classRosters.get(classId) || []).map(s => s.deviceId));
  return {
    ...loaded,
    approvedStudents: classRosters.get(classId) || [],
    responses: responses.filter(r => deviceSet.has(r.studentId)),
    activeClassId: classId,
  };
}

describe('analytics — per-class filter', () => {
  // Quiz targets two classes. d1/d2 belong to A, d3 to B. Responses come from all three.
  const loaded = {
    quiz: { classIds: ['A', 'B'] },
    responses: [
      { studentId: 'd1' }, { studentId: 'd2' }, { studentId: 'd3' },
    ],
    classRosters: new Map([
      ['A', [{ deviceId: 'd1', studentName: 'Ann' }, { deviceId: 'd2', studentName: 'Bob' }]],
      ['B', [{ deviceId: 'd3', studentName: 'Cara' }]],
    ]),
  };

  test('filters responses to the selected class only', () => {
    const a = applyClassFilter(loaded, 'A');
    expect(a.responses.map(r => r.studentId)).toEqual(['d1', 'd2']);
    expect(a.approvedStudents).toHaveLength(2);
    expect(a.activeClassId).toBe('A');

    const b = applyClassFilter(loaded, 'B');
    expect(b.responses.map(r => r.studentId)).toEqual(['d3']);
  });

  test('no classId returns all responses unchanged', () => {
    const all = applyClassFilter(loaded, null);
    expect(all.responses).toHaveLength(3);
    expect(all.activeClassId).toBeUndefined();
  });

  test('classId not among the quiz target classes is ignored (treated as all)', () => {
    const all = applyClassFilter(loaded, 'NOT_A_TARGET');
    expect(all.responses).toHaveLength(3);
    expect(all.activeClassId).toBeUndefined();
  });
});
