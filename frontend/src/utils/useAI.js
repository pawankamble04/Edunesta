import { useState } from "react";

export default function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAI = async (fn) => {
    try {
      setLoading(true);
      setError(null);
      return await fn();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "AI service unavailable. Try again."
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, runAI };
}
