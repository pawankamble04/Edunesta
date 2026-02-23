import { Link } from "react-router-dom";
import heroImage from "../../assets/hero.png";

export default function Home() {
  return (
    <section
      className="min-h-screen pt-24 flex items-center animate-gradient"
      style={{
        backgroundImage: `
          linear-gradient(
            to right,
            rgba(17,24,39,0.92),
            rgba(30,64,175,0.85),
            rgba(96,165,250,0.65),
            rgba(219,234,254,0.25)
          ),
          url(${heroImage})
        `,
        backgroundSize: "cover",
        backgroundPosition: "center right",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 w-full">
        
        <div className="max-w-xl text-white">

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-fade-up">
            EduNesta
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-blue-100 mb-8 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            Smart Education Platform <br />
            for Students & Teachers
          </p>

          {/* Buttons */}
          <div
            className="flex gap-4 animate-fade-up"
            style={{ animationDelay: "0.6s" }}
          >
            <Link
              to="/login"
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 transition transform hover:scale-110 duration-300 font-semibold shadow-lg"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="px-6 py-3 rounded-lg bg-green-500 hover:bg-green-600 transition transform hover:scale-110 duration-300 font-semibold shadow-lg"
            >
              Register
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
