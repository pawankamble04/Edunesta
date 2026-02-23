import { useEffect, useRef } from "react";

export default function useVisiblePolling(
  task,
  intervalMs,
  { enabled = true, runOnMount = true } = {}
) {
  const taskRef = useRef(task);
  const runningRef = useRef(false);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    if (!enabled || !Number.isFinite(intervalMs) || intervalMs <= 0) {
      return undefined;
    }

    let cancelled = false;

    const run = () => {
      if (cancelled || document.hidden || runningRef.current) return;
      runningRef.current = true;

      Promise.resolve(taskRef.current())
        .catch(() => {
          // Individual screens handle their own error UX.
        })
        .finally(() => {
          runningRef.current = false;
        });
    };

    if (runOnMount) {
      run();
    }

    const intervalId = setInterval(run, intervalMs);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        run();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, runOnMount]);
}
