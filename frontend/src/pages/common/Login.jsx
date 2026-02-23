import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../utils/axios";
import { getToken, getUser, setAuth } from "../../utils/storage";
import GoogleAuthButton from "../../components/auth/GoogleAuthButton";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const res = await api.post("/auth/login", { email, password });

      setAuth({
        token: res.data.token,
        user: res.data.user,
      });

      navigate(`/${res.data.user.role}`);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="min-h-screen flex items-center justify-center px-4
                 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-950
                 animate-gradient"
    >
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-white/10 backdrop-blur-xl
                   border border-white/20 rounded-2xl shadow-2xl p-8
                   animate-fade-up"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-white animate-fade-up">
            Welcome Back
          </h2>
          <p
            className="text-slate-300 mt-2 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            Login to your EduNesta account
          </p>
        </div>

        {/* Email */}
        <div
          className="mb-4 animate-fade-up"
          style={{ animationDelay: "0.4s" }}
        >
          <label className="block text-sm font-medium text-slate-200 mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-lg bg-white/20 text-white
                       border border-white/30
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password */}
        <div
          className="mb-6 animate-fade-up"
          style={{ animationDelay: "0.6s" }}
        >
          <label className="block text-sm font-medium text-slate-200 mb-1">
            Password
          </label>
          <input
            type="password"
            placeholder="********"
            className="w-full px-4 py-3 rounded-lg bg-white/20 text-white
                       border border-white/30
                       focus:outline-none focus:ring-2 focus:ring-blue-500
                       transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Button */}
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full py-3 rounded-lg bg-blue-600 text-white
                     font-semibold hover:bg-blue-700 disabled:opacity-60
                     transform hover:scale-105 transition duration-300 shadow-lg"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <GoogleAuthButton
          setError={setError}
          onLoadingChange={setGoogleLoading}
        />

        {/* Footer */}
        <p className="text-sm text-center mt-6 text-slate-300">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-green-400 font-medium hover:underline">
            Register
          </Link>
        </p>
      </form>
    </section>
  );
}
