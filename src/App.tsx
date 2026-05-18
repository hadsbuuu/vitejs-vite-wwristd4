import { useState, useEffect, useCallback, useMemo } from "react";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FULL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TODAY_IDX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

const COLORS = {
  high: { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E", dot: "#F59E0B" },
  medium: { bg: "#EFF6FF", border: "#3B82F6", text: "#1E40AF", dot: "#3B82F6" },
  low: { bg: "#F0FDF4", border: "#22C55E", text: "#166534", dot: "#22C55E" },
};

function genId() { return Math.random().toString(36).slice(2,9); }

const SAMPLE_PROJECTS = [
  { id: genId(), name: "Tech Blog", weeklyGoals: "2 blogs, 15 backlinks, interlinking", priority: "high", color: "#F59E0B" },
  { id: genId(), name: "Health Blog", weeklyGoals: "1 blog, 10 backlinks", priority: "medium", color: "#3B82F6" },
];

function parseGoals(goalsText, projectId, projectName, priority) {
  const tasks = [];
  const parts = goalsText.toLowerCase().split(",").map(s => s.trim());

  parts.forEach(part => {
    const blogsMatch = part.match(/(\d+)\s*blog/);
    const backlinksMatch = part.match(/(\d+)\s*backlink/);
    const interMatch = part.match(/interlink/);
    const wordsMatch = part.match(/(\d+)\s*word/);

    if (blogsMatch) {
      const count = parseInt(blogsMatch[1]);
      const days = count <= 3 ? [0, 2, 4].slice(0, count) : [0,1,2,3,4,5,6].slice(0, count);
      days.forEach(d => {
        tasks.push({ id: genId(), projectId, projectName, priority, title: "Write blog post", day: d, done: false, type: "blog" });
      });
    }
    if (backlinksMatch) {
      const total = parseInt(backlinksMatch[1]);
      const daysCount = Math.min(Math.ceil(total / 5), 7);
      const perDay = Math.ceil(total / daysCount);
      let remaining = total;
      for (let d = 0; d < daysCount; d++) {
        const n = Math.min(perDay, remaining);
        tasks.push({ id: genId(), projectId, projectName, priority, title: `Build ${n} backlinks`, day: d, done: false, type: "backlinks" });
        remaining -= n;
        if (remaining <= 0) break;
      }
    }
    if (interMatch) {
      tasks.push({ id: genId(), projectId, projectName, priority, title: "Internal linking audit", day: 3, done: false, type: "interlinking" });
    }
    if (wordsMatch) {
      const count = parseInt(wordsMatch[1]);
      [0,1,2,3,4].forEach(d => {
        tasks.push({ id: genId(), projectId, projectName, priority, title: `Write ${count} words`, day: d, done: false, type: "writing" });
      });
    }
  });

  return tasks;
}

function balanceTasks(tasks) {
  const MAX = 6;
  const dayLoad = Array(7).fill(0);
  tasks.forEach(t => { if (t.day >= 0 && t.day < 7) dayLoad[t.day]++; });

  return tasks.map(t => {
    let day = t.day;
    if (dayLoad[day] > MAX) {
      for (let d = 0; d < 7; d++) {
        if (dayLoad[d] < MAX) { dayLoad[day]--; dayLoad[d]++; day = d; break; }
      }
    }
    return { ...t, day };
  });
}

const HABITS_DEFAULT = [
  { id: genId(), label: "Write 500 words", streak: 3, completedToday: false },
  { id: genId(), label: "Read 20 min", streak: 7, completedToday: false },
];

export default function App() {
  const [view, setView] = useState("dashboard");
  const [projects, setProjects] = useState(SAMPLE_PROJECTS);
  const [tasks, setTasks] = useState([]);
  const [habits, setHabits] = useState(HABITS_DEFAULT);
  const [newProject, setNewProject] = useState({ name: "", weeklyGoals: "", priority: "medium" });
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [justStartIdx, setJustStartIdx] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [dragTask, setDragTask] = useState(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [habitInput, setHabitInput] = useState("");

  useEffect(() => {
    const initial = [];
    SAMPLE_PROJECTS.forEach(p => {
      const parsed = parseGoals(p.weeklyGoals, p.id, p.name, p.priority);
      initial.push(...parsed);
    });
    setTasks(balanceTasks(initial));
  }, []);

  const todayTasks = useMemo(() => tasks.filter(t => t.day === TODAY_IDX), [tasks]);
  const missedTasks = useMemo(() => tasks.filter(t => t.day < TODAY_IDX && !t.done), [tasks]);
  const upcomingTasks = useMemo(() => tasks.filter(t => t.day > TODAY_IDX), [tasks]);

  const completionRate = useMemo(() => {
    const due = tasks.filter(t => t.day <= TODAY_IDX);
    if (!due.length) return 0;
    return Math.round((due.filter(t => t.done).length / due.length) * 100);
  }, [tasks]);

  const toggleTask = (id) => setTasks(ts => ts.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = (id) => setTasks(ts => ts.filter(t => t.id !== id));
  const moveTask = (id, day) => setTasks(ts => ts.map(t => t.id === id ? { ...t, day } : t));

  const addProject = () => {
    if (!newProject.name.trim()) return;
    const p = { id: genId(), ...newProject, color: ["#F59E0B","#3B82F6","#22C55E","#EF4444","#8B5CF6"][Math.floor(Math.random()*5)] };
    setProjects(ps => [...ps, p]);
    const parsed = parseGoals(newProject.weeklyGoals, p.id, p.name, newProject.priority);
    setTasks(ts => balanceTasks([...ts, ...parsed]));
    setNewProject({ name: "", weeklyGoals: "", priority: "medium" });
    setShowAddProject(false);
  };

  const deleteProject = (id) => {
    setProjects(ps => ps.filter(p => p.id !== id));
    setTasks(ts => ts.filter(t => t.projectId !== id));
  };

  const autoReschedule = () => {
    setTasks(ts => {
      const rescheduled = ts.map(t => {
        if (t.day < TODAY_IDX && !t.done) {
          let newDay = TODAY_IDX;
          const dayLoad = Array(7).fill(0);
          ts.forEach(x => { if (x.day >= 0 && x.day < 7) dayLoad[x.day]++; });
          for (let d = TODAY_IDX; d < 7; d++) {
            if (dayLoad[d] < 6) { newDay = d; break; }
          }
          return { ...t, day: newDay };
        }
        return t;
      });
      return rescheduled;
    });
  };

  const getAiSuggestion = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a productivity assistant for bloggers. When given a vague task description, respond ONLY with a JSON object (no markdown, no preamble) like:
{"suggestion": "7 backlinks/day for 7 days", "breakdown": [{"day": "Monday", "task": "Build 7 backlinks"}, ...], "reasoning": "Spreads load evenly..."}
Keep breakdown to max 7 days. Be concrete and actionable.`,
          messages: [{ role: "user", content: `Suggest an optimized weekly plan for: "${aiInput}"` }]
        })
      });
      const data = await resp.json();
      const raw = data.content?.[0]?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      setAiSuggestion(JSON.parse(clean));
    } catch {
      setAiSuggestion({ suggestion: "Couldn't reach AI — try: 5 per day for 4 days", breakdown: [], reasoning: "Balanced distribution over weekdays." });
    }
    setAiLoading(false);
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion?.breakdown?.length) return;
    const newTasks = aiSuggestion.breakdown.map((b, i) => ({
      id: genId(), projectId: projects[0]?.id || "manual", projectName: projects[0]?.name || "Manual",
      priority: "medium", title: b.task, day: Math.min(i, 6), done: false, type: "custom"
    }));
    setTasks(ts => balanceTasks([...ts, ...newTasks]));
    setAiSuggestion(null);
    setAiInput("");
  };

  const justStartTasks = todayTasks.filter(t => !t.done);

  const dayTaskCount = (d) => tasks.filter(t => t.day === d).length;

  // FOCUS MODE
  if (focusMode) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAFAF9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "'Georgia', serif" }}>
        <button onClick={() => setFocusMode(false)} style={{ position: "absolute", top: 20, right: 20, background: "none", border: "1px solid #D1D5DB", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, color: "#6B7280" }}>✕ Exit Focus</button>
        <p style={{ fontSize: 13, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2rem" }}>Focus Mode · {FULL_DAYS[TODAY_IDX]}</p>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: "2rem", color: "#111827" }}>Today's Tasks</h2>
        <div style={{ width: "100%", maxWidth: 480 }}>
          {todayTasks.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 16 }}>No tasks today. Enjoy your day!</p>
          ) : todayTasks.map(t => (
            <div key={t.id} onClick={() => toggleTask(t.id)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: t.done ? "#F9FAFB" : "#fff", border: "1px solid #E5E7EB", borderRadius: 12, marginBottom: 10, cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: t.done ? "none" : "2px solid #D1D5DB", background: t.done ? "#22C55E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {t.done && <span style={{ color: "#fff", fontSize: 13 }}>✓</span>}
              </div>
              <span style={{ fontSize: 16, color: t.done ? "#9CA3AF" : "#111827", textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF", background: "#F3F4F6", padding: "2px 8px", borderRadius: 999 }}>{t.projectName}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, textAlign: "center" }}>
          <span style={{ fontSize: 14, color: "#6B7280" }}>{todayTasks.filter(t=>t.done).length}/{todayTasks.length} complete</span>
        </div>
      </div>
    );
  }

  // JUST START MODE
  if (view === "juststart") {
    const todo = justStartTasks;
    const current = todo[justStartIdx];
    return (
      <div style={{ minHeight: "100vh", background: "#0F172A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "system-ui" }}>
        <button onClick={() => setView("dashboard")} style={{ position: "absolute", top: 20, left: 20, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#94A3B8" }}>← Back</button>
        <div style={{ textAlign: "center", maxWidth: 520 }}>
          <p style={{ fontSize: 12, letterSpacing: "0.2em", color: "#475569", textTransform: "uppercase", marginBottom: "1.5rem" }}>Task {justStartIdx + 1} of {todo.length}</p>
          {current ? (
            <>
              <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 20, padding: "3rem 2.5rem", marginBottom: "2rem" }}>
                <p style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>{current.projectName}</p>
                <h2 style={{ fontSize: 28, color: "#F1F5F9", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{current.title}</h2>
              </div>
              <button onClick={() => { toggleTask(current.id); setJustStartIdx(i => Math.min(i + 1, todo.length - 1)); }} style={{ background: "#22C55E", border: "none", borderRadius: 12, padding: "16px 48px", fontSize: 18, color: "#fff", cursor: "pointer", fontWeight: 600, letterSpacing: "-0.02em" }}>Done ✓</button>
              <p style={{ marginTop: 16, color: "#475569", fontSize: 13 }}>tap when complete to see next task</p>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h2 style={{ color: "#F1F5F9", fontSize: 28, marginBottom: 8 }}>All done!</h2>
              <p style={{ color: "#64748B" }}>You've completed all tasks for today.</p>
              <button onClick={() => { setView("dashboard"); setJustStartIdx(0); }} style={{ marginTop: 24, background: "#3B82F6", border: "none", borderRadius: 10, padding: "12px 32px", color: "#fff", cursor: "pointer", fontSize: 16 }}>Back to Dashboard</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "⊞" },
    { id: "tasks", label: "Weekly Plan", icon: "◫" },
    { id: "projects", label: "Projects", icon: "◈" },
    { id: "habits", label: "Habits", icon: "◎" },
    { id: "stats", label: "Stats", icon: "◑" },
    { id: "ai", label: "AI Planner", icon: "◆" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F4", fontFamily: "'Inter', system-ui, sans-serif", display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: "#fff", borderRight: "1px solid #E5E7EB", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ marginBottom: "1.5rem", padding: "0 0.5rem" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.03em" }}>BlogFlow</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>AI Productivity</div>
        </div>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", background: view === n.id ? "#F3F4F6" : "transparent", cursor: "pointer", fontSize: 14, color: view === n.id ? "#111827" : "#6B7280", fontWeight: view === n.id ? 500 : 400, textAlign: "left" }}>
            <span style={{ fontSize: 16 }}>{n.icon}</span>{n.label}
          </button>
        ))}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => setFocusMode(true)} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", fontSize: 13, color: "#374151", textAlign: "left" }}>🎯 Focus Mode</button>
          <button onClick={() => { setJustStartIdx(0); setView("juststart"); }} style={{ padding: "9px 12px", borderRadius: 8, border: "none", background: "#0F172A", cursor: "pointer", fontSize: 13, color: "#fff", textAlign: "left" }}>▶ Just Start</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>{FULL_DAYS[TODAY_IDX]}</h1>
                <p style={{ color: "#9CA3AF", fontSize: 14, margin: "4px 0 0" }}>
                  {todayTasks.filter(t=>t.done).length} of {todayTasks.length} tasks done
                  {missedTasks.length > 0 && <span style={{ color: "#EF4444", marginLeft: 8 }}>· {missedTasks.length} missed</span>}
                </p>
              </div>
              {missedTasks.length > 0 && (
                <button onClick={autoReschedule} style={{ padding: "8px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, color: "#EF4444", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>↺ Reschedule missed</button>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: "1.5rem" }}>
              {[
                { label: "Today", value: todayTasks.length, sub: "tasks" },
                { label: "Done", value: todayTasks.filter(t=>t.done).length, sub: "today" },
                { label: "Missed", value: missedTasks.length, sub: "tasks" },
                { label: "Rate", value: completionRate + "%", sub: "completion" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "16px" }}>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Today tasks */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: 15, fontWeight: 600, color: "#111827" }}>Today's Tasks</h3>
              {todayTasks.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 14 }}>No tasks for today.</p> : todayTasks.map(t => <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} onEdit={setEditTask} />)}
            </div>

            {/* Upcoming preview */}
            {upcomingTasks.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: 15, fontWeight: 600, color: "#111827" }}>Upcoming (next 3)</h3>
                {upcomingTasks.slice(0,3).map(t => <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} onEdit={setEditTask} muted />)}
              </div>
            )}

            {/* Habits quick */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.25rem" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: 15, fontWeight: 600, color: "#111827" }}>Habits</h3>
              {habits.map(h => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <button onClick={() => setHabits(hs => hs.map(x => x.id === h.id ? { ...x, completedToday: !x.completedToday, streak: !x.completedToday ? x.streak + 1 : Math.max(0, x.streak - 1) } : x))} style={{ width: 24, height: 24, borderRadius: "50%", border: h.completedToday ? "none" : "2px solid #D1D5DB", background: h.completedToday ? "#22C55E" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {h.completedToday && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
                  </button>
                  <span style={{ flex: 1, fontSize: 14, color: h.completedToday ? "#9CA3AF" : "#111827", textDecoration: h.completedToday ? "line-through" : "none" }}>{h.label}</span>
                  <span style={{ fontSize: 12, color: "#F59E0B", background: "#FEF3C7", padding: "2px 8px", borderRadius: 999 }}>🔥 {h.streak}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WEEKLY PLAN */}
        {view === "tasks" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Weekly Plan</h1>
              {missedTasks.length > 0 && <button onClick={autoReschedule} style={{ padding: "8px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, color: "#EF4444", cursor: "pointer", fontSize: 13 }}>↺ Auto-reschedule {missedTasks.length} missed</button>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {DAYS.map((day, d) => {
                const dayTasks = tasks.filter(t => t.day === d);
                const isToday = d === TODAY_IDX;
                const isPast = d < TODAY_IDX;
                return (
                  <div key={d} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragTask) { moveTask(dragTask, d); setDragTask(null); } }} style={{ background: isToday ? "#EFF6FF" : "#fff", border: `1px solid ${isToday ? "#BFDBFE" : "#E5E7EB"}`, borderRadius: 12, padding: "12px 8px", minHeight: 200, opacity: isPast ? 0.7 : 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? "#2563EB" : "#9CA3AF", marginBottom: 8, textAlign: "center" }}>
                      {day}
                      {isToday && <span style={{ display: "block", fontSize: 10, color: "#3B82F6" }}>Today</span>}
                      <span style={{ display: "block", fontSize: 10, color: dayTasks.length >= 6 ? "#EF4444" : "#9CA3AF" }}>{dayTasks.length}/6</span>
                    </div>
                    {dayTasks.sort((a,b) => { const p = {high:0,medium:1,low:2}; return p[a.priority]-p[b.priority]; }).map(t => (
                      <div key={t.id} draggable onDragStart={() => setDragTask(t.id)} onClick={() => toggleTask(t.id)} style={{ padding: "6px 8px", borderRadius: 6, background: t.done ? "#F9FAFB" : COLORS[t.priority]?.bg || "#F9FAFB", border: `1px solid ${t.done ? "#E5E7EB" : COLORS[t.priority]?.border || "#E5E7EB"}`, marginBottom: 4, cursor: "pointer", fontSize: 11, color: t.done ? "#9CA3AF" : "#111827", textDecoration: t.done ? "line-through" : "none" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[t.priority]?.dot, display: "inline-block", marginRight: 4 }} />
                        {t.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROJECTS */}
        {view === "projects" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Projects</h1>
              <button onClick={() => setShowAddProject(!showAddProject)} style={{ padding: "8px 16px", background: "#111827", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14 }}>+ New Project</button>
            </div>
            {showAddProject && (
              <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.5rem", marginBottom: "1.5rem" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: 16, fontWeight: 600 }}>New Project</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} placeholder="Project name (e.g., Tech Blog)" style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, outline: "none" }} />
                  <textarea value={newProject.weeklyGoals} onChange={e => setNewProject(p => ({ ...p, weeklyGoals: e.target.value }))} placeholder="Weekly goals (e.g., 2 blogs, 20 backlinks, interlinking)" rows={3} style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, outline: "none", resize: "vertical" }} />
                  <select value={newProject.priority} onChange={e => setNewProject(p => ({ ...p, priority: e.target.value }))} style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14 }}>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={addProject} style={{ flex: 1, padding: "10px", background: "#111827", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14 }}>Create & Generate Tasks</button>
                    <button onClick={() => setShowAddProject(false)} style={{ padding: "10px 20px", background: "#F3F4F6", border: "none", borderRadius: 8, color: "#6B7280", cursor: "pointer", fontSize: 14 }}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {projects.map(p => {
                const pTasks = tasks.filter(t => t.projectId === p.id);
                const done = pTasks.filter(t => t.done).length;
                return (
                  <div key={p.id} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: p.color }} />
                        <div>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827" }}>{p.name}</h3>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9CA3AF" }}>{p.weeklyGoals}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: COLORS[p.priority]?.bg, color: COLORS[p.priority]?.text, border: `1px solid ${COLORS[p.priority]?.border}` }}>{p.priority}</span>
                        <button onClick={() => deleteProject(p.id)} style={{ padding: "4px 8px", background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: 16 }}>×</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pTasks.length ? `${(done/pTasks.length)*100}%` : "0%", background: p.color, borderRadius: 3, transition: "width 0.3s" }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#9CA3AF", flexShrink: 0 }}>{done}/{pTasks.length} tasks</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* HABITS */}
        {view === "habits" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Habits & Consistency</h1>
            </div>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.25rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
                <input value={habitInput} onChange={e => setHabitInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && habitInput.trim()) { setHabits(hs => [...hs, { id: genId(), label: habitInput.trim(), streak: 0, completedToday: false }]); setHabitInput(""); } }} placeholder="Add a daily habit (press Enter)..." style={{ flex: 1, padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, outline: "none" }} />
                <button onClick={() => { if (habitInput.trim()) { setHabits(hs => [...hs, { id: genId(), label: habitInput.trim(), streak: 0, completedToday: false }]); setHabitInput(""); } }} style={{ padding: "10px 16px", background: "#111827", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14 }}>Add</button>
              </div>
              {habits.map(h => (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <button onClick={() => setHabits(hs => hs.map(x => x.id === h.id ? { ...x, completedToday: !x.completedToday, streak: !x.completedToday ? x.streak + 1 : Math.max(0, x.streak - 1) } : x))} style={{ width: 28, height: 28, borderRadius: "50%", border: h.completedToday ? "none" : "2px solid #D1D5DB", background: h.completedToday ? "#22C55E" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {h.completedToday && <span style={{ color: "#fff", fontSize: 14 }}>✓</span>}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: h.completedToday ? "#9CA3AF" : "#111827", textDecoration: h.completedToday ? "line-through" : "none" }}>{h.label}</div>
                    <div style={{ fontSize: 12, color: h.streak > 0 ? "#F59E0B" : "#9CA3AF" }}>{h.completedToday ? "✓ Done today" : "Pending today"}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span style={{ fontSize: 20 }}>🔥</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#F59E0B" }}>{h.streak}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>streak</span>
                  </div>
                  <button onClick={() => setHabits(hs => hs.filter(x => x.id !== h.id))} style={{ padding: "4px 8px", background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATS */}
        {view === "stats" && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: "1.5rem" }}>Reality Check</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: "1.5rem" }}>
              {[
                { label: "Total Tasks This Week", value: tasks.length },
                { label: "Completed", value: tasks.filter(t=>t.done).length, color: "#22C55E" },
                { label: "Missed / Pending Past", value: missedTasks.length, color: "#EF4444" },
                { label: "Completion Rate", value: completionRate + "%", color: completionRate >= 70 ? "#22C55E" : completionRate >= 40 ? "#F59E0B" : "#EF4444" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.5rem" }}>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: s.color || "#111827" }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.5rem", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: "0 0 1rem", fontSize: 15, fontWeight: 600 }}>Daily Load</h3>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
                {DAYS.map((d, i) => {
                  const count = dayTaskCount(i);
                  const done = tasks.filter(t => t.day === i && t.done).length;
                  return (
                    <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: "100%", position: "relative", height: 80, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <div style={{ width: "100%", height: `${(count / 6) * 80}px`, background: "#E5E7EB", borderRadius: "4px 4px 0 0", position: "absolute", bottom: 0 }} />
                        <div style={{ width: "100%", height: `${(done / 6) * 80}px`, background: i === TODAY_IDX ? "#3B82F6" : "#22C55E", borderRadius: "4px 4px 0 0", position: "absolute", bottom: 0 }} />
                      </div>
                      <span style={{ fontSize: 10, color: i === TODAY_IDX ? "#3B82F6" : "#9CA3AF" }}>{d}</span>
                      <span style={{ fontSize: 10, color: "#9CA3AF" }}>{done}/{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background: completionRate >= 70 ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${completionRate >= 70 ? "#BBF7D0" : "#FECACA"}`, borderRadius: 14, padding: "1.25rem" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: completionRate >= 70 ? "#166534" : "#991B1B", marginBottom: 4 }}>
                {completionRate >= 70 ? "🟢 On track" : completionRate >= 40 ? "🟡 Needs improvement" : "🔴 Off track"}
              </div>
              <div style={{ fontSize: 13, color: completionRate >= 70 ? "#166534" : "#991B1B" }}>
                {completionRate >= 70 ? "You're completing most tasks. Keep the momentum!" : completionRate >= 40 ? "You're completing some tasks but have room to improve. Consider reducing your weekly goals." : "Most tasks are incomplete. Start with just 1 task per day and build up gradually."}
              </div>
            </div>
          </div>
        )}

        {/* AI PLANNER */}
        {view === "ai" && (
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>AI Planner</h1>
            <p style={{ color: "#9CA3AF", fontSize: 14, marginBottom: "1.5rem" }}>Describe a vague goal and get an optimized weekly plan.</p>
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "1.5rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
                <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") getAiSuggestion(); }} placeholder="e.g., '50 backlinks', '3 blogs this week', 'increase traffic'" style={{ flex: 1, padding: "12px 16px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, outline: "none" }} />
                <button onClick={getAiSuggestion} disabled={aiLoading} style={{ padding: "12px 20px", background: "#111827", border: "none", borderRadius: 10, color: "#fff", cursor: aiLoading ? "default" : "pointer", fontSize: 14, opacity: aiLoading ? 0.7 : 1 }}>{aiLoading ? "Thinking…" : "Optimize ◆"}</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["50 backlinks", "3 blog posts", "keyword research + 2 blogs", "20 guest posts"].map(ex => (
                  <button key={ex} onClick={() => setAiInput(ex)} style={{ padding: "5px 12px", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 999, fontSize: 12, color: "#6B7280", cursor: "pointer" }}>{ex}</button>
                ))}
              </div>
            </div>
            {aiSuggestion && (
              <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 14, padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#166534", fontWeight: 500, marginBottom: 4 }}>AI Suggestion</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: "#111827" }}>{aiSuggestion.suggestion}</div>
                    <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>{aiSuggestion.reasoning}</div>
                  </div>
                  <button onClick={() => setAiSuggestion(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 20 }}>×</button>
                </div>
                {aiSuggestion.breakdown?.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "1rem" }}>
                    {aiSuggestion.breakdown.map((b, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fff", borderRadius: 8, fontSize: 13 }}>
                        <span style={{ color: "#9CA3AF", minWidth: 70 }}>{b.day}</span>
                        <span style={{ color: "#111827" }}>{b.task}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={applyAiSuggestion} style={{ padding: "10px 24px", background: "#16A34A", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Apply to My Plan</button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Edit Task Modal */}
      {editTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setEditTask(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: "1.5rem", width: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: 16, fontWeight: 600 }}>Edit Task</h3>
            <input defaultValue={editTask.title} id="edit-title" style={{ width: "100%", padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
            <select defaultValue={editTask.day} id="edit-day" style={{ width: "100%", padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, marginBottom: 10 }}>
              {FULL_DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
            </select>
            <select defaultValue={editTask.priority} id="edit-priority" style={{ width: "100%", padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { const title = document.getElementById("edit-title").value; const day = parseInt(document.getElementById("edit-day").value); const priority = document.getElementById("edit-priority").value; setTasks(ts => ts.map(t => t.id === editTask.id ? { ...t, title, day, priority } : t)); setEditTask(null); }} style={{ flex: 1, padding: "10px", background: "#111827", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 14 }}>Save</button>
              <button onClick={() => setEditTask(null)} style={{ padding: "10px 20px", background: "#F3F4F6", border: "none", borderRadius: 8, color: "#6B7280", cursor: "pointer", fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete, onEdit, muted }) {
  const c = COLORS[task.priority] || COLORS.medium;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F3F4F6", opacity: muted ? 0.6 : 1 }}>
      <button onClick={() => onToggle(task.id)} style={{ width: 22, height: 22, borderRadius: "50%", border: task.done ? "none" : `2px solid ${c.border}`, background: task.done ? "#22C55E" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {task.done && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: task.done ? "#9CA3AF" : "#111827", textDecoration: task.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</div>
        <div style={{ fontSize: 12, color: "#9CA3AF" }}>{task.projectName} · {FULL_DAYS[task.day]}</div>
      </div>
      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: c.bg, color: c.text, border: `1px solid ${c.border}`, flexShrink: 0 }}>{task.priority}</span>
      <button onClick={() => onEdit(task)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 15, padding: "4px" }}>✎</button>
      <button onClick={() => onDelete(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", fontSize: 16, padding: "4px" }}>×</button>
    </div>
  );
}