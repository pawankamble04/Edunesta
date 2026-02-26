import { Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import RequireAuth from "./auth/RequireAuth";
import api from "./utils/axios";
import { clearAuth, getToken, setAuth } from "./utils/storage";

/* Layouts */
import AdminLayout from "./layouts/AdminLayout";
import TeacherLayout from "./layouts/TeacherLayout";
import StudentLayout from "./layouts/StudentLayout";
import ParentLayout from "./layouts/ParentLayout";
import PublicLayout from "./layouts/PublicLayout";

/* Public Pages */
import Home from "./pages/common/Home";
import Login from "./pages/common/Login";
import Register from "./pages/common/Register";

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
import AITestCreator from "./pages/teacher/AITestCreator";
import Submissions from "./pages/teacher/Submissions";
import TeacherMaterials from "./pages/teacher/Materials";
import Tests from "./pages/teacher/Tests";
import TeacherLectures from "./pages/teacher/Lectures";
import TeacherExamPrepTracking from "./pages/teacher/TeacherExamPrepTracking";

/* Student Pages */
import StudentDashboard from "./pages/student/StudentDashboard";
import AvailableTests from "./pages/student/AvailableTests";
import AttemptTest from "./pages/student/AttemptTest";
import Results from "./pages/student/Results";
import StudentMaterials from "./pages/student/Materials";
import ConnectTeacher from "./pages/student/ConnectTeacher";
import StudentLectures from "./pages/student/Lectures";
import AIRoadmaps from "./pages/student/AIRoadmaps";
import ExamAutoPrep from "./pages/student/ExamAutoPrep";
import PYQPractice from "./pages/student/PYQPractice";

/* Parent Pages */
import ParentDashboard from "./pages/parent/ParentDashboard";
import ParentResults from "./pages/parent/ParentResults";
import ParentExamPrepSummary from "./pages/parent/ParentExamPrepSummary";

export default function App() {
  useEffect(() => {
    const syncAuth = async () => {
      try {
        const token = getToken();
        if (!token) {
          clearAuth();
          return;
        }

        const res = await api.get("/auth/me", { withCredentials: true });
        if (res.data?.user) {
          setAuth({ token, user: res.data.user });
        }
      } catch {
        clearAuth();
      }
    };

    void syncAuth();
  }, []);

  return (
    <>
      <Navbar />

      <Routes>
        {/* PUBLIC */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

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
          <Route path="ai-test" element={<AITestCreator />} />
          <Route path="exam-prep" element={<TeacherExamPrepTracking />} />
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
          <Route path="ai-roadmaps" element={<AIRoadmaps />} />
          <Route path="exam-auto-prep" element={<ExamAutoPrep />} />
          <Route path="pyq-practice" element={<PYQPractice />} />
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
          <Route path="exam-prep" element={<ParentExamPrepSummary />} />
          <Route path="results/:studentId" element={<ParentResults />} />
        </Route>
      </Routes>
    </>
  );
}
