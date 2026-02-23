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

/* Admin Pages */
import AdminDashboard from "./pages/admin/AdminDashboard";
import Users from "./pages/admin/Users";
import Teachers from "./pages/admin/Teachers";
import Moderation from "./pages/admin/Moderation";
import Logs from "./pages/admin/Logs";

/* Teacher Pages */
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CreateTest from "./pages/teacher/CreateTest";
import Questions from "./pages/teacher/Questions";
import Submissions from "./pages/teacher/Submissions";
import TeacherMaterials from "./pages/teacher/Materials";
import Tests from "./pages/teacher/Tests";
import TeacherLectures from "./pages/teacher/Lectures";

/* Student Pages */
import StudentDashboard from "./pages/student/StudentDashboard";
import AvailableTests from "./pages/student/AvailableTests";
import AttemptTest from "./pages/student/AttemptTest";
import Results from "./pages/student/Results";
import StudentMaterials from "./pages/student/Materials";
import ConnectTeacher from "./pages/student/ConnectTeacher";
import StudentLectures from "./pages/student/Lectures";

/* Parent Pages */
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentResults from "./pages/parent/ParentResults";

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
        <Route
          path="/admin"
          element={
            <RequireAuth role="ADMIN">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="logs" element={<Logs />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="moderation" element={<Moderation />} />
        </Route>

        {/* TEACHER */}
        <Route
          path="/teacher"
          element={
            <RequireAuth role="teacher">
              <TeacherLayout />
            </RequireAuth>
          }
        >
          <Route index element={<TeacherDashboard />} />
          <Route path="tests" element={<Tests />} />
          <Route path="create-test" element={<CreateTest />} />
          <Route path="questions" element={<Questions />} />
          <Route path="submissions/:testId" element={<Submissions />} />
          <Route path="materials" element={<TeacherMaterials />} />
          <Route path="lectures" element={<TeacherLectures />} />
        </Route>

        {/* STUDENT */}
        <Route
          path="/student"
          element={
            <RequireAuth role="student">
              <StudentLayout />
            </RequireAuth>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="tests" element={<AvailableTests />} />
          <Route path="attempt/:testId" element={<AttemptTest />} />
          <Route path="results" element={<Results />} />
          <Route path="materials" element={<StudentMaterials />} />
          <Route path="lectures" element={<StudentLectures />} />
          <Route path="connect" element={<ConnectTeacher />} />
        </Route>

        {/* PARENT */}
        <Route
          path="/parent"
          element={
            <RequireAuth role="parent">
              <ParentLayout />
            </RequireAuth>
          }
        >
          <Route index element={<ParentDashboard />} />
          <Route path="results/:studentId" element={<ParentResults />} />
        </Route>
      </Routes>
    </>
  );
}
