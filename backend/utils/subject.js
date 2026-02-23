export const normalizeSubject = (value) => {
  const subject = String(value || "").trim().toLowerCase();

  if (!subject) return "";

  const aliasMap = {
    math: "math",
    maths: "math",
    mathematics: "math",
  };

  return aliasMap[subject] || subject;
};
