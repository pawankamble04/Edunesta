// grader.js
// Compares student's selected option indexes with correctAnswers (arrays of indexes)
// Returns { isCorrect, marksObtained }

function gradeQuestion(questionDoc, selectedIndexes) {
  if (!questionDoc) return { isCorrect: false, marksObtained: 0 };
  const correct = (questionDoc.correctAnswers || []).map(Number).sort();
  const selected = (selectedIndexes || []).map(Number).sort();

  const isSame =
    correct.length === selected.length &&
    correct.every((val, idx) => val === selected[idx]);

  const marks = isSame ? (questionDoc.marks || 1) : 0;
  return { isCorrect: isSame, marksObtained: marks };
}

module.exports = { gradeQuestion };
