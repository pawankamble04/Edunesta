import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">EduNesta</h1>
        <p className="text-gray-300 mb-8">
          Smart Education Platform for Students & Teachers
        </p>

        <div className="flex justify-center gap-4">
          <Link
            to="/login"
            className="bg-blue-600 px-6 py-2 rounded"
          >
            Login
          </Link>

          <Link
            to="/register"
            className="bg-green-600 px-6 py-2 rounded"
          >
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
