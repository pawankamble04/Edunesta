import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import api from "../../utils/axios";
import { setAuth } from "../../utils/storage";

export default function GoogleAuthButton({
  setError,
  onLoadingChange,
  dividerClassName = "my-5 flex items-center gap-3 text-xs text-slate-300",
  loadingTextClassName = "mt-3 text-center text-sm text-slate-200",
}) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const hasGoogleClientId = Boolean(
    String(import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim()
  );

  if (!hasGoogleClientId) {
    return (
      <>
        <div className={dividerClassName}>
          <span className="h-px flex-1 bg-white/20" />
          <span>OR</span>
          <span className="h-px flex-1 bg-white/20" />
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/30
                       bg-white/10 px-6 text-sm font-medium text-slate-200 opacity-80"
          >
            Continue with Google
          </button>
        </div>

        <p className={loadingTextClassName}>
          Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>frontend/.env</code> and
          restart Vite.
        </p>
      </>
    );
  }

  const setBusy = (value) => {
    setLoading(value);
    onLoadingChange?.(value);
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;

    if (!credential) {
      setError?.("Google authentication failed");
      return;
    }

    try {
      setError?.("");
      setBusy(true);

      const res = await api.post("/auth/google", { credential });

      setAuth({
        token: res.data.token,
        user: res.data.user,
      });

      navigate(`/${res.data.user.role}`);
    } catch (err) {
      setError?.(err.response?.data?.message || "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleError = () => {
    setError?.("Google authentication failed");
  };

  return (
    <>
      <div className={dividerClassName}>
        <span className="h-px flex-1 bg-white/20" />
        <span>OR</span>
        <span className="h-px flex-1 bg-white/20" />
      </div>

      <div
        className={`flex justify-center ${
          loading ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap={false}
          text="continue_with"
          theme="outline"
          shape="pill"
          size="large"
        />
      </div>

      {loading && <p className={loadingTextClassName}>Signing in with Google...</p>}
    </>
  );
}
