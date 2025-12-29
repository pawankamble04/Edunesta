export default function StudentMaterials() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Study Materials</h1>

      <ul className="bg-white border rounded divide-y">
        <li className="p-4 flex justify-between">
          <span>Java Basics Notes</span>
          <button className="text-blue-600">Download</button>
        </li>
        <li className="p-4 flex justify-between">
          <span>OOP Concepts</span>
          <button className="text-blue-600">Download</button>
        </li>
      </ul>
    </div>
  );
}
