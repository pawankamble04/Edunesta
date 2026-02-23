import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../services/api";

export default function AttemptTest() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const submitLock = useRef(false);
  const answersRef = useRef({});
  const questionsRef = useRef([]);
  const submittedRef = useRef(false);

  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [loadError, setLoadError] = useState("");
  const TEST_TIME_OVER_MESSAGE =
    "Your test time is over. You can no longer submit this attempt.";

  useEffect(() => {
    setLoadingQuestions(true);
    setLoadError("");
    setSubmitError("");
    setSubmitted(false);
    submitLock.current = false;
    submittedRef.current = false;
    setCurrent(0);
    setAnswers({});
    answersRef.current = {};
    setTimeLeft(0);

    API.get(`/tests/${testId}`)
      .then((res) => {
        const payload = res.data || {};
        const nextQuestions = Array.isArray(payload.questions)
          ? payload.questions
          : [];
        setQuestions(nextQuestions);

        const fallbackSeconds = Number(payload.durationMinutes || 0) * 60;
        const remainingSeconds = Number(payload.attempt?.remainingSeconds);
        const initialSeconds = Number.isFinite(remainingSeconds)
          ? Math.max(remainingSeconds, 0)
          : Number.isFinite(fallbackSeconds) && fallbackSeconds > 0
            ? Math.floor(fallbackSeconds)
            : 300;
        setTimeLeft(initialSeconds);

        if (nextQuestions.length === 0) {
          setLoadError("No questions found for this test.");
        }
      })
      .catch((err) => {
        const serverMessage = err.response?.data?.message || "";
        if (
          serverMessage ===
          "You have already submitted this test"
        ) {
          navigate("/student/results");
          return;
        }
        if (serverMessage === "Test time is over") {
          setLoadError(TEST_TIME_OVER_MESSAGE);
          return;
        }
        console.error("Failed to load questions", err);
        setLoadError(
          serverMessage || "Failed to load test questions."
        );
      })
      .finally(() => setLoadingQuestions(false));
  }, [navigate, testId]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  const handleSubmit = useCallback(async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitError("");

    try {
      setSubmitted(true);
      submittedRef.current = true;

      const latestQuestions = questionsRef.current;
      const latestAnswers = answersRef.current;
      const formattedAnswers = latestQuestions.map((q, index) => ({
        question: q._id,
        selected: latestAnswers[index] ?? null,
      }));

      const res = await API.post("/submissions/submit", {
        testId,
        answers: formattedAnswers,
      });

      if (res?.data?.message === "Test submitted successfully") {
        navigate("/student/results");
      }
    } catch (error) {
      const serverMessage = error.response?.data?.message || "";
      if (
        serverMessage ===
        "You have already submitted this test"
      ) {
        navigate("/student/results");
        return;
      }
      if (serverMessage === "Test time is over") {
        setSubmitError(TEST_TIME_OVER_MESSAGE);
        submitLock.current = false;
        submittedRef.current = false;
        setSubmitted(false);
        return;
      }

      console.error("Submission failed", error);
      setSubmitError(serverMessage || "Failed to submit test");
      submitLock.current = false;
      submittedRef.current = false;
      setSubmitted(false);
    }
  }, [navigate, testId]);

  useEffect(() => {
    if (submitted || loadingQuestions || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          if (!submittedRef.current) {
            void handleSubmit();
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitted, loadingQuestions, questions.length, handleSubmit]);

  const handleSelect = (index) => {
    setAnswers((prev) => ({ ...prev, [current]: index }));
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    }
  };

  if (loadingQuestions) {
    return <p className="text-center mt-10">Loading questions...</p>;
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto">
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
        <button
          onClick={() => navigate("/student/tests")}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Back to Tests
        </button>
      </div>
    );
  }

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
        <p>
          Time Left: {Math.floor(timeLeft / 60)}:
          {String(timeLeft % 60).padStart(2, "0")}
        </p>
      </div>

      <div className="bg-white p-6 rounded shadow">
        {submitError && (
          <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {submitError}
          </p>
        )}
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
