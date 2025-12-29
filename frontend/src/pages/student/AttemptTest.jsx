import { useState, useEffect } from "react";

export default function AttemptTest() {
  const questions = [
    {
      id: 1,
      text: "What is JVM?",
      options: ["Compiler", "Interpreter", "Virtual Machine", "OS"],
    },
    {
      id: 2,
      text: "Java is ___ language",
      options: ["Low-level", "High-level", "Machine", "Assembly"],
    },
  ];

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
  const [submitted, setSubmitted] = useState(false);

  // TIMER
  useEffect(() => {
    if (submitted) return;

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted]);

  const handleSelect = (index) => {
    setAnswers({ ...answers, [current]: index });
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    }
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Test Submitted</h1>
        <p className="mt-4">Your responses have been recorded.</p>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex justify-between mb-4 text-sm text-gray-600">
        <p>
          Question {current + 1} / {questions.length}
        </p>
        <p>Time Left: {Math.floor(timeLeft / 60)}:{timeLeft % 60}</p>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="font-semibold mb-4">{q.text}</h2>

        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <label
              key={i}
              className={`block border p-2 rounded cursor-pointer ${
                answers[current] === i ? "border-blue-600" : ""
              }`}
            >
              <input
                type="radio"
                name="option"
                className="mr-2"
                checked={answers[current] === i}
                onChange={() => handleSelect(i)}
              />
              {opt}
            </label>
          ))}
        </div>

        <div className="flex justify-between mt-6">
          {current < questions.length - 1 ? (
            <button
              onClick={handleNext}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
