import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../utils/axios";
import { getToken, getUser } from "../../utils/storage";
import GoogleAuthButton from "../../components/auth/GoogleAuthButton";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    const token = getToken();
    const user = getUser();

    if (token && user) {
      navigate(`/${user.role}`);
    }
  }, [navigate]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      await api.post("/auth/register", {
        name,
        email,
        password,
        role,
      });
      navigate("/login");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="min-h-screen pt-24 flex items-center justify-center px-4
                 bg-gradient-to-br from-slate-900 via-green-900 to-slate-950
                 animate-gradient"
    >
      <form
        onSubmit={handleRegister}
        className="w-full max-w-sm bg-white/10 backdrop-blur-xl
                   border border-white/20 rounded-xl shadow-2xl p-6
                   animate-fade-up"
      >
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-2xl font-semibold text-white">
            Create Account
          </h2>
          <p className="text-xs text-slate-300 mt-1">Join EduNesta</p>
        </div>

        {error && (
          <p className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {/* Full Name */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-200 mb-1">
            Full Name
          </label>
          <input
            type="text"
            placeholder="Your full name"
            className="w-full px-3 py-2 rounded-md bg-white/20 text-white
                       border border-white/30
                       text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Email */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-200 mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full px-3 py-2 rounded-md bg-white/20 text-white
                       border border-white/30
                       text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-200 mb-1">
            Password
          </label>
          <input
            type="password"
            placeholder="********"
            className="w-full px-3 py-2 rounded-md bg-white/20 text-white
                       border border-white/30
                       text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Role */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-200 mb-1">
            Register as
          </label>
          <select
            className="w-full px-3 py-2 rounded-md bg-white/20 text-white
                       border border-white/30
                       text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="student" className="text-black">
              Student
            </option>
            <option value="teacher" className="text-black">
              Teacher
            </option>
            <option value="parent" className="text-black">
              Parent
            </option>
          </select>
        </div>

        {/* Button */}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full py-2 rounded-md bg-green-600 text-white
                     text-sm font-semibold hover:bg-green-700 disabled:opacity-60
                     transform hover:scale-105 transition duration-300"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

        <GoogleAuthButton
          setError={setError}
          onLoadingChange={setGoogleLoading}
          dividerClassName="my-4 flex items-center gap-3 text-xs text-slate-300"
          loadingTextClassName="mt-3 text-center text-xs text-slate-200"
        />

        {/* Footer */}
        <p className="text-xs text-center mt-4 text-slate-300">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-400 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </section>
  );
}
