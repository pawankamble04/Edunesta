import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import API from "../../services/api";

const MODE_OPTIONS = {
  student: [
    { value: "quick_doubt", label: "Quick Doubt" },
    { value: "weak_topic_drill", label: "Weak Topic Drill" },
    { value: "exam_prep", label: "Exam Prep" },
    { value: "last_minute_revision", label: "Last-Min Revision" },
  ],
  teacher: [
    { value: "class_insights", label: "Class Insights" },
    { value: "intervention_plan", label: "Intervention Plan" },
    { value: "question_improvement", label: "Question Improve" },
  ],
  parent: [
    { value: "daily_support", label: "Daily Support" },
    { value: "motivation_coach", label: "Motivation Coach" },
    { value: "weekly_planner", label: "Weekly Planner" },
  ],
};

const ROLE_TITLE = {
  student: "AI Study Buddy",
  teacher: "AI Teaching Assistant",
  parent: "AI Parent Assistant",
};

const ROLE_WELCOME = {
  student:
    "Share your doubt or weak topic. I will guide you using your recent test and mastery data.",
  teacher:
    "Ask for class insights, intervention ideas, or question quality improvements based on real class performance.",
  parent:
    "Ask how to support your child today. I will use linked-child progress and suggest practical next actions.",
};

const ROLE_META = {
  student: {
    badge: "from-blue-600 to-indigo-600",
    panel: "from-blue-600 to-indigo-600",
    light: "bg-blue-100 text-blue-700 border-blue-200",
    icon: "S",
  },
  teacher: {
    badge: "from-emerald-600 to-teal-600",
    panel: "from-emerald-600 to-teal-600",
    light: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: "T",
  },
  parent: {
    badge: "from-amber-500 to-orange-500",
    panel: "from-amber-500 to-orange-500",
    light: "bg-amber-100 text-amber-700 border-amber-200",
    icon: "P",
  },
};

const QUICK_ACTIONS = {
  student: {
    quick_doubt: [
      "Explain this topic in simple steps.",
      "Give me 5 quick practice questions.",
      "Make a 20-minute revision plan for today.",
    ],
    weak_topic_drill: [
      "Start a weak-topic drill for my lowest topic.",
      "Give me hint-first questions, not direct answers.",
      "Tell me the most common mistakes in this topic.",
    ],
    exam_prep: [
      "Create a 3-day exam prep plan.",
      "Tell me high-yield topics from recent tests.",
      "Give me a last-hour checklist before exam.",
    ],
    last_minute_revision: [
      "Give me a 30-minute last-minute revision flow.",
      "What should I revise first right now?",
      "Give formula and concept recall prompts.",
    ],
  },
  teacher: {
    class_insights: [
      "Summarize class weak topics this week.",
      "Which tests are underperforming and why?",
      "Give me a 15-minute remedial class plan.",
    ],
    intervention_plan: [
      "Create a 7-day intervention plan for weak students.",
      "How should I group students by weakness?",
      "Give a targeted worksheet strategy.",
    ],
    question_improvement: [
      "How can I improve question clarity and distractors?",
      "Give common MCQ quality mistakes to avoid.",
      "Suggest a balanced difficulty mix for next test.",
    ],
  },
  parent: {
    daily_support: [
      "What should my child study today?",
      "Give me one short evening support plan.",
      "How can I help without pressuring too much?",
    ],
    motivation_coach: [
      "Give positive motivation lines for my child.",
      "How do I handle low-score days constructively?",
      "How to build consistency at home?",
    ],
    weekly_planner: [
      "Create a practical weekly study routine.",
      "How can I track progress in simple way?",
      "What warning signs should I watch this week?",
    ],
  },
};

const FOLLOW_UP_ACTIONS = {
  student: {
    quick_doubt: [
      "Explain simpler",
      "Give 5 targeted questions",
      "Create 20-min plan",
    ],
    weak_topic_drill: [
      "Start question drill",
      "Give hint-first challenge",
      "Show common mistakes",
    ],
    exam_prep: [
      "Build 3-day plan",
      "Prioritize topics",
      "Last-hour checklist",
    ],
    last_minute_revision: [
      "30-min crash plan",
      "Rapid recap points",
      "Quick self-test",
    ],
  },
  teacher: {
    class_insights: [
      "Top weak topics",
      "Class intervention plan",
      "Remedial micro-test",
    ],
    intervention_plan: [
      "Group students smartly",
      "7-day rescue plan",
      "Worksheet strategy",
    ],
    question_improvement: [
      "Improve distractors",
      "Set clarity checklist",
      "Better difficulty mix",
    ],
  },
  parent: {
    daily_support: [
      "Today action plan",
      "Evening routine",
      "Gentle follow-up lines",
    ],
    motivation_coach: [
      "Positive message ideas",
      "Handle low scores",
      "Consistency habit tips",
    ],
    weekly_planner: [
      "Weekly routine",
      "Track progress simply",
      "Warning signs",
    ],
  },
};

const MAX_HISTORY = 8;
const MAX_MESSAGE_LENGTH = 700;
const FLOATING_MARGIN = 8;

const normalizeRole = (value) => {
  const role = String(value || "").trim().toLowerCase();
  if (role === "teacher" || role === "parent" || role === "student") return role;
  return "student";
};

const toChildrenOptions = (children) =>
  (Array.isArray(children) ? children : [])
    .map((child) => ({
      id: String(child?._id || child?.id || "").trim(),
      name: String(child?.name || "Student").trim(),
    }))
    .filter((child) => child.id);

const makeMessage = (role, text, source = "ai", createdAt = new Date().toISOString()) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text: String(text || "").trim(),
  source: String(source || "user").toLowerCase(),
  createdAt,
});

const mapServerMessages = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) =>
      makeMessage(
        String(row?.role || "").toLowerCase() === "assistant" ? "assistant" : "user",
        row?.text || "",
        row?.source || "user",
        row?.createdAt || new Date().toISOString()
      )
    )
    .filter((row) => row.text);
};

const formatTime = (isoString) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getRoleInitial = (role) => String(role || "S").trim().charAt(0).toUpperCase() || "S";

const renderInlineMarkdown = (text, keyPrefix) => {
  const segments = String(text || "").split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return segments.map((segment, index) => {
    const key = `${keyPrefix}-inline-${index}`;
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded bg-slate-200 px-1 py-0.5 text-[90%] text-slate-900"
        >
          {segment.slice(1, -1)}
        </code>
      );
    }
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return <strong key={key}>{segment.slice(2, -2)}</strong>;
    }
    return <span key={key}>{segment}</span>;
  });
};

const renderAssistantMarkdown = (text, keyPrefix) => {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""));
  const blocks = [];
  let index = 0;
  let blockCount = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length && lines[index].startsWith("```")) {
        index += 1;
      }

      blocks.push(
        <pre
          key={`${keyPrefix}-code-${blockCount}`}
          className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      blockCount += 1;
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      const headingText = line.replace(/^#{1,3}\s+/, "").trim();
      blocks.push(
        <p key={`${keyPrefix}-h-${blockCount}`} className="font-semibold text-slate-900">
          {renderInlineMarkdown(headingText, `${keyPrefix}-h-${blockCount}`)}
        </p>
      );
      blockCount += 1;
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quoteLines.push(lines[index].slice(2).trim());
        index += 1;
      }

      blocks.push(
        <blockquote
          key={`${keyPrefix}-q-${blockCount}`}
          className="border-l-2 border-slate-300 pl-3 text-slate-700"
        >
          {renderInlineMarkdown(quoteLines.join(" "), `${keyPrefix}-q-${blockCount}`)}
        </blockquote>
      );
      blockCount += 1;
      continue;
    }

    if (line.startsWith("- ")) {
      const items = [];
      while (index < lines.length && lines[index].startsWith("- ")) {
        items.push(lines[index].slice(2).trim());
        index += 1;
      }

      blocks.push(
        <ul key={`${keyPrefix}-ul-${blockCount}`} className="list-disc pl-5 space-y-1">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ul-${blockCount}-${itemIndex}`}>
              {renderInlineMarkdown(item, `${keyPrefix}-ul-${blockCount}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
      blockCount += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, "").trim());
        index += 1;
      }

      blocks.push(
        <ol key={`${keyPrefix}-ol-${blockCount}`} className="list-decimal pl-5 space-y-1">
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ol-${blockCount}-${itemIndex}`}>
              {renderInlineMarkdown(item, `${keyPrefix}-ol-${blockCount}-${itemIndex}`)}
            </li>
          ))}
        </ol>
      );
      blockCount += 1;
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith("- ") &&
      !/^\d+\.\s+/.test(lines[index]) &&
      !lines[index].startsWith("```") &&
      !/^#{1,3}\s+/.test(lines[index]) &&
      !lines[index].startsWith("> ")
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push(
      <p key={`${keyPrefix}-p-${blockCount}`} className="leading-relaxed">
        {renderInlineMarkdown(paragraphLines.join(" "), `${keyPrefix}-p-${blockCount}`)}
      </p>
    );
    blockCount += 1;
  }

  return <div className="space-y-2">{blocks}</div>;
};

export default function RoleStudyBuddyChat({
  role = "student",
  linkedChildren = [],
}) {
  const resolvedRole = normalizeRole(role);
  const modeOptions = MODE_OPTIONS[resolvedRole] || MODE_OPTIONS.student;
  const roleMeta = ROLE_META[resolvedRole] || ROLE_META.student;
  const childOptions = useMemo(
    () => toChildrenOptions(linkedChildren),
    [linkedChildren]
  );

  const [mode, setMode] = useState(modeOptions[0]?.value || "quick_doubt");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [messages, setMessages] = useState([
    makeMessage("assistant", ROLE_WELCOME[resolvedRole] || ROLE_WELCOME.student, "system"),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(null);

  const messageContainerRef = useRef(null);
  const floatingRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    offsetX: 0,
    offsetY: 0,
    width: 0,
    height: 0,
    onMove: null,
    onUp: null,
  });

  const constrainPosition = useCallback((x, y, width, height) => {
    const maxX = Math.max(FLOATING_MARGIN, window.innerWidth - width - FLOATING_MARGIN);
    const maxY = Math.max(FLOATING_MARGIN, window.innerHeight - height - FLOATING_MARGIN);
    return {
      x: clamp(x, FLOATING_MARGIN, maxX),
      y: clamp(y, FLOATING_MARGIN, maxY),
    };
  }, []);

  const stopDrag = useCallback(() => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    setIsDragging(false);
    if (dragStateRef.current.onMove) {
      window.removeEventListener("pointermove", dragStateRef.current.onMove);
    }
    if (dragStateRef.current.onUp) {
      window.removeEventListener("pointerup", dragStateRef.current.onUp);
      window.removeEventListener("pointercancel", dragStateRef.current.onUp);
    }
    dragStateRef.current.onMove = null;
    dragStateRef.current.onUp = null;
  }, []);

  const onDragPointerDown = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (dragStateRef.current.active) return;
      const container = floatingRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const nextPosition = constrainPosition(rect.left, rect.top, rect.width, rect.height);
      setPosition(nextPosition);

      dragStateRef.current.active = true;
      dragStateRef.current.offsetX = event.clientX - rect.left;
      dragStateRef.current.offsetY = event.clientY - rect.top;
      dragStateRef.current.width = rect.width;
      dragStateRef.current.height = rect.height;

      const onMove = (moveEvent) => {
        if (!dragStateRef.current.active) return;
        moveEvent.preventDefault();
        const rawX = moveEvent.clientX - dragStateRef.current.offsetX;
        const rawY = moveEvent.clientY - dragStateRef.current.offsetY;
        const constrained = constrainPosition(
          rawX,
          rawY,
          dragStateRef.current.width,
          dragStateRef.current.height
        );
        setPosition(constrained);
      };

      const onUp = () => stopDrag();

      dragStateRef.current.onMove = onMove;
      dragStateRef.current.onUp = onUp;
      setIsDragging(true);
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      event.preventDefault();
    },
    [constrainPosition, stopDrag]
  );

  const quickActions = useMemo(() => {
    const byRole = QUICK_ACTIONS[resolvedRole] || {};
    return byRole[mode] || [];
  }, [resolvedRole, mode]);

  const followUpActions = useMemo(() => {
    const byRole = FOLLOW_UP_ACTIONS[resolvedRole] || {};
    return byRole[mode] || [];
  }, [resolvedRole, mode]);

  const latestAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") return messages[index].id;
    }
    return "";
  }, [messages]);

  const resetToWelcome = () => {
    setMessages([
      makeMessage(
        "assistant",
        ROLE_WELCOME[resolvedRole] || ROLE_WELCOME.student,
        "system"
      ),
    ]);
    setConversationId("");
  };

  useEffect(() => {
    setMode(modeOptions[0]?.value || "quick_doubt");
    setError("");
    setInput("");
    resetToWelcome();
  }, [resolvedRole]);

  useEffect(() => {
    if (resolvedRole !== "parent") return;
    setSelectedStudentId((prev) => {
      if (prev && childOptions.some((child) => child.id === prev)) return prev;
      return childOptions[0]?.id || "";
    });
  }, [resolvedRole, childOptions]);

  useEffect(() => {
    if (!messageContainerRef.current) return;
    messageContainerRef.current.scrollTo({
      top: messageContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, historyLoading]);

  useEffect(() => () => stopDrag(), [stopDrag]);

  useEffect(() => {
    if (!position) return undefined;

    const handleResize = () => {
      const container = floatingRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setPosition((prev) => {
        if (!prev) return prev;
        return constrainPosition(prev.x, prev.y, rect.width, rect.height);
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position, constrainPosition]);

  useEffect(() => {
    if (!position) return;
    const container = floatingRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setPosition((prev) => {
      if (!prev) return prev;
      return constrainPosition(prev.x, prev.y, rect.width, rect.height);
    });
  }, [isOpen, position, constrainPosition]);

  useEffect(() => {
    if (!isOpen) return;
    if (resolvedRole === "parent" && !selectedStudentId) {
      resetToWelcome();
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        setError("");
        const params = { mode };
        if (resolvedRole === "parent") {
          params.studentId = selectedStudentId;
        }

        const res = await API.get("/ai/study-buddy/history", { params });
        if (cancelled) return;

        const historyMessages = mapServerMessages(res.data?.messages);
        if (historyMessages.length > 0) {
          setMessages(historyMessages);
        } else {
          resetToWelcome();
        }

        setConversationId(String(res.data?.conversationId || ""));
      } catch (err) {
        if (cancelled) return;
        setError(
          err.response?.data?.error || "Could not load saved conversation."
        );
        resetToWelcome();
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [isOpen, resolvedRole, mode, selectedStudentId]);

  const sendMessage = async (rawMessage = null) => {
    const message = String(rawMessage ?? input ?? "")
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH);

    if (!message || loading || historyLoading) return;

    if (resolvedRole === "parent" && !selectedStudentId) {
      setError("Link a child first to use parent assistant.");
      return;
    }

    setError("");
    if (rawMessage === null) {
      setInput("");
    }

    const userMessage = makeMessage("user", message, "user");
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      setLoading(true);

      const history = nextMessages
        .filter((item) => item.role === "user" || item.role === "assistant")
        .slice(-MAX_HISTORY)
        .map((item) => ({
          role: item.role,
          content: item.text,
        }));

      const payload = {
        mode,
        message,
        history,
      };

      if (conversationId) {
        payload.conversationId = conversationId;
      }
      if (resolvedRole === "parent") {
        payload.studentId = selectedStudentId;
      }

      const res = await API.post("/ai/study-buddy/chat", payload);

      const serverMessages = mapServerMessages(res.data?.messages);
      if (serverMessages.length > 0) {
        setMessages(serverMessages);
      } else {
        setMessages((prev) => [
          ...prev,
          makeMessage(
            "assistant",
            String(res.data?.reply || "").trim() ||
              "I could not generate a response right now.",
            res.data?.source || "ai"
          ),
        ]);
      }

      setConversationId(String(res.data?.conversationId || ""));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to get assistant response.");
      setMessages((prev) => [
        ...prev,
        makeMessage(
          "assistant",
          "I could not respond right now. Please try again in a moment.",
          "fallback"
        ),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = async () => {
    if (loading || historyLoading) return;
    setError("");

    try {
      const params = { mode };
      if (resolvedRole === "parent") {
        params.studentId = selectedStudentId;
      }

      await API.delete("/ai/study-buddy/history", { params });
      resetToWelcome();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to clear conversation.");
    }
  };

  const onInputKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const userInitial = getRoleInitial(resolvedRole);
  const floatingClassName = `fixed z-50 ${
    position ? "" : "bottom-5 right-5"
  } ${isDragging ? "select-none" : ""}`;
  const floatingStyle = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
      }
    : undefined;

  return (
    <div ref={floatingRef} className={floatingClassName} style={floatingStyle}>
      {!isOpen ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={`rounded-full bg-gradient-to-r ${roleMeta.panel} text-white px-4 py-3 shadow-lg hover:brightness-95 transition`}
          >
            <span className="font-semibold">{ROLE_TITLE[resolvedRole]}</span>
          </button>
          <button
            type="button"
            onPointerDown={onDragPointerDown}
            aria-label="Drag chat widget"
            className="h-10 w-10 rounded-full border border-slate-200 bg-white text-slate-500 shadow-md hover:text-slate-700 cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ::
            </span>
          </button>
        </div>
      ) : (
        <section className="w-[min(96vw,420px)] h-[min(85vh,700px)] rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden">
          <div
            className={`bg-gradient-to-r ${roleMeta.panel} text-white px-4 py-3 flex items-center justify-between gap-3`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={onDragPointerDown}
                aria-label="Drag chat panel"
                className="h-8 w-8 rounded-full bg-white/20 grid place-items-center text-sm cursor-grab active:cursor-grabbing"
                style={{ touchAction: "none" }}
              >
                ::
              </button>
              <div className="h-8 w-8 rounded-full bg-white/20 grid place-items-center font-bold">
                {roleMeta.icon}
              </div>
              <div>
                <p className="font-semibold text-sm">{ROLE_TITLE[resolvedRole]}</p>
                <p className="text-[11px] text-white/80">Role-aware assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearConversation}
                className="text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-1"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-1"
              >
                Minimize
              </button>
            </div>
          </div>

          <div className="p-3 border-b bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="border rounded px-3 py-2 text-sm bg-white"
              >
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {resolvedRole === "parent" ? (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="border rounded px-3 py-2 text-sm bg-white"
                  disabled={childOptions.length === 0}
                >
                  {childOptions.length === 0 ? (
                    <option value="">No linked child</option>
                  ) : (
                    childOptions.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))
                  )}
                </select>
              ) : null}
            </div>

            {quickActions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => void sendMessage(action)}
                    disabled={loading || historyLoading}
                    className={`text-[11px] px-2.5 py-1 rounded-full border ${roleMeta.light} hover:brightness-95 disabled:opacity-60`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div
            ref={messageContainerRef}
            className="flex-1 overflow-y-auto bg-white px-3 py-3 space-y-3"
          >
            {historyLoading ? (
              <p className="text-sm text-slate-500">Loading conversation...</p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-end gap-2 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div
                      className={`h-8 w-8 shrink-0 rounded-full bg-gradient-to-r ${roleMeta.panel} text-white text-xs font-semibold grid place-items-center shadow-sm`}
                      title="AI Assistant"
                    >
                      AI
                    </div>
                  ) : null}

                  <div className="max-w-[88%]">
                    <div
                      className={`rounded-xl px-3 py-2 text-sm border shadow-sm ${
                        message.role === "user"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-800 border-slate-200"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        renderAssistantMarkdown(message.text, message.id)
                      ) : (
                        <p className="whitespace-pre-wrap">{message.text}</p>
                      )}
                      <div
                        className={`mt-1 text-[10px] ${
                          message.role === "user" ? "text-blue-100" : "text-slate-500"
                        }`}
                      >
                        {formatTime(message.createdAt)}
                        {message.role === "assistant" && message.source === "fallback"
                          ? " | Fallback"
                          : ""}
                      </div>
                    </div>

                    {message.role === "assistant" &&
                    message.id === latestAssistantMessageId &&
                    followUpActions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {followUpActions.map((action) => (
                          <button
                            key={`${message.id}-${action}`}
                            type="button"
                            onClick={() => void sendMessage(action)}
                            disabled={loading || historyLoading}
                            className={`text-[10px] px-2 py-1 rounded-full border ${roleMeta.light} disabled:opacity-60`}
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {message.role === "user" ? (
                    <div
                      className="h-8 w-8 shrink-0 rounded-full bg-slate-900 text-white text-xs font-semibold grid place-items-center shadow-sm"
                      title="You"
                    >
                      {userInitial}
                    </div>
                  ) : null}
                </div>
              ))
            )}

            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Thinking...
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t bg-slate-50 p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
              onKeyDown={onInputKeyDown}
              rows={3}
              placeholder="Type your message..."
              className="w-full border rounded px-3 py-2 text-sm bg-white"
            />

            <div className="mt-1 flex items-center justify-between">
              <p className="text-[11px] text-slate-500">
                Enter send | Shift+Enter newline
              </p>
              <p
                className={`text-[11px] ${
                  input.length > MAX_MESSAGE_LENGTH - 60
                    ? "text-amber-700"
                    : "text-slate-400"
                }`}
              >
                {input.length}/{MAX_MESSAGE_LENGTH}
              </p>
            </div>

            {error ? <p className="text-sm text-red-600 mt-1">{error}</p> : null}

            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={
                loading ||
                historyLoading ||
                !String(input || "").trim() ||
                (resolvedRole === "parent" && !selectedStudentId)
              }
              className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
