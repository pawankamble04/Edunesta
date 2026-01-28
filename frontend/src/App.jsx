import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import RequireAuth from "./auth/RequireAuth";
import api from "./utils/axios";

/* Layouts */
import AdminLayout from "./layouts/AdminLayout";
import TeacherLayout from "./layouts/TeacherLayout";
import StudentLayout from "./layouts/StudentLayout";
import ParentLayout from "./layouts/ParentLayout";

/* Public Pages */
import Home from "./pages/common/Home";
import Login from "./pages/common/Login";
import Register from "./pages/common/Register";

/* Admin Pages */
import AdminDashboard from "./pages/admin/AdminDashboard";
import Users from "./pages/admin/Users";
import Teachers from "./pages/admin/Teachers";
import Moderation from "./pages/admin/Moderation";

/* Teacher Pages */
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CreateTest from "./pages/teacher/CreateTest";
import Questions from "./pages/teacher/Questions";
import Submissions from "./pages/teacher/Submissions";
import TeacherMaterials from "./pages/teacher/Materials";
import Tests from "./pages/teacher/Tests";

/* Student Pages */
import StudentDashboard from "./pages/student/StudentDashboard";
import AvailableTests from "./pages/student/AvailableTests";
import AttemptTest from "./pages/student/AttemptTest";
import Results from "./pages/student/Results";
import StudentMaterials from "./pages/student/Materials";

/* Parent Pages */
import ParentDashboard from "./pages/parent/ParentDashboard";

export default function App() {
  // ✅ AUTH PERSISTENCE CHECK
  useEffect(() => {
    const syncAuth = async () => {
      try {
        const res = await api.get("/auth/me", { withCredentials: true });
        localStorage.setItem("user", JSON.stringify(res.data.user));
      } catch {
        localStorage.removeItem("user");
      }
    };

    syncAuth();
  }, []);

  return (
    <>
      <Navbar />

      <Routes>
        {/* PUBLIC */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ADMIN */}
        <Route element={<RequireAuth role="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="moderation" element={<Moderation />} />
          </Route>
        </Route>

        {/* TEACHER */}
        <Route element={<RequireAuth role="teacher" />}>
          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="tests" element={<Tests />} />
            <Route path="create-test" element={<CreateTest />} />
            <Route path="questions" element={<Questions />} />
            <Route path="submissions/:testId" element={<Submissions />} />
            <Route path="materials" element={<TeacherMaterials />} />
          </Route>
        </Route>

        {/* STUDENT */}
        <Route element={<RequireAuth role="student" />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="tests" element={<AvailableTests />} />
            <Route path="attempt/:testId" element={<AttemptTest />} />
            <Route path="results" element={<Results />} />
            <Route path="materials" element={<StudentMaterials />} />
          </Route>
        </Route>

        {/* PARENT */}
        <Route element={<RequireAuth role="parent" />}>
          <Route path="/parent" element={<ParentLayout />}>
            <Route index element={<ParentDashboard />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
