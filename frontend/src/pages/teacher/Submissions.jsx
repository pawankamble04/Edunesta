import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../../services/api";

export default function Submissions() {
  const { testId } = useParams();
  const [subs, setSubs] = useState([]);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    API.get(`/submissions/test/${testId}`)
      .then((res) => setSubs(res.data))
      .catch(console.error);
  }, [testId]);

  const downloadExcel = async () => {
    setDownloadError("");
    try {
      setLoadingExcel(true);

      const response = await API.get(
        `/submissions/export/${testId}`,
        { responseType: "blob" }
      );

      // Extract filename from header
      const contentDisposition =
        response.headers["content-disposition"];

      let filename = "submissions.csv";

      if (contentDisposition) {
        const match =
          contentDisposition.match(/filename="?(.+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Download failed:", error);
      setDownloadError(
        error.response?.data?.message || "Failed to download CSV"
      );
    } finally {
      setLoadingExcel(false);
    }
  };

  return (
    <div className="p-6 pt-24">

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">
          Student Submissions
        </h1>

        <button
          onClick={downloadExcel}
          disabled={loadingExcel || subs.length === 0}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg shadow transition"
        >
          {loadingExcel
            ? "Downloading..."
            : "Download CSV"}
        </button>
      </div>
      {downloadError && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {downloadError}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full bg-white border text-sm rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">
                Student
              </th>
              <th className="text-left">
                Score
              </th>
              <th className="text-left">
                Submitted
              </th>
            </tr>
          </thead>

          <tbody>
            {subs.map((s) => (
              <tr
                key={s._id}
                className="border-t hover:bg-gray-50"
              >
                <td className="p-3">
                  {s.student?.name}
                </td>
                <td>
                  {s.score} / {s.totalMarks}
                </td>
                <td>
                  {new Date(
                    s.submittedAt
                  ).toLocaleString()}
                </td>
              </tr>
            ))}

            {subs.length === 0 && (
              <tr>
                <td
                  colSpan="3"
                  className="text-center p-4 text-gray-500"
                >
                  No submissions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
