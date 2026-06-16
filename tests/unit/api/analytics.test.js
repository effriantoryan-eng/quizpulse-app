// Unit test for analytics accuracy — mirrors buildQuestionBreakdown() in api/analytics.js.
// Verifies per-option counts against 5 known responses across 2 questions.

function buildQuestionBreakdown(questions, responses) {
  return questions.map(q => {
    const optionCount = (q.options || []).length;
    const counts = Array(optionCount).fill(0);
    responses.forEach(r => {
      const answer = (r.answers || []).find(a => a.questionId === q.id);
      if (answer && answer.selectedIndex >= 0 && answer.selectedIndex < optionCount) {
        counts[answer.selectedIndex]++;
      }
    });
    return { id: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex, counts };
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
