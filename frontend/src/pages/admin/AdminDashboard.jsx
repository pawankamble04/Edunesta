import { useEffect, useState } from "react";
import api from "../../utils/axios";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    console.log("AdminDashboard mounted");

    api
      .get("/admin/dashboard")
      .then((res) => {
        // ✅ THIS IS WHERE THE LOG GOES
        console.log("ADMIN DASHBOARD DATA:", res.data);

        setStats(res.data);
      })
      .catch((err) => {
        console.error(
          "Admin dashboard error:",
          err.response?.data || err.message
        );
      });
  }, []);

  if (!stats) return <p>Loading admin dashboard...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Stat title="Total Users" value={stats.totalUsers} />
        <Stat title="Teachers" value={stats.totalTeachers} />
        <Stat title="Students" value={stats.totalStudents} />
        <Stat title="Total Tests" value={stats.totalTests} />
        <Health status="Healthy" />
      </div>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="bg-white border p-4 rounded">
      <p className="text-xs text-gray-500 uppercase">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Health({ status }) {
  return (
    <div className="bg-white border p-4 rounded">
      <p className="text-xs text-gray-500 uppercase">System Health</p>
      <p className="text-green-600 text-xl font-semibold">{status}</p>
    </div>
  );
}
