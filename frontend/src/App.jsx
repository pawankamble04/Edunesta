import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import RequireAuth from "./auth/RequireAuth";

/* Public Pages */
import Home from "./pages/common/Home";
import Login from "./pages/common/Login";
import Register from "./pages/common/Register";

/* Layouts */
import AdminLayout from "./layouts/AdminLayout";
import TeacherLayout from "./layouts/TeacherLayout";
import StudentLayout from "./layouts/StudentLayout";

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

export default function App() {
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
            <RequireAuth role="admin">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<Users />} />
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

          {/* ✅ FIXED ROUTE (IMPORTANT CHANGE) */}
          <Route path="submissions/:testId" element={<Submissions />} />

          <Route path="materials" element={<TeacherMaterials />} />
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
          <Route path="attempt" element={<AttemptTest />} />
          <Route path="results" element={<Results />} />
          <Route path="materials" element={<StudentMaterials />} />
        </Route>
      </Routes>
    </>
  );
}
