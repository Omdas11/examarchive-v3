"use client";

import { useState } from "react";

export default function UploadForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");

      setMessage("Paper uploaded successfully — pending approval.");
      (e.target as HTMLFormElement).reset();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <input name="title" placeholder="Title" required className="input-field" />
        <input name="course_code" placeholder="Course Code" required className="input-field" />
        <input name="course_name" placeholder="Course Name" required className="input-field" />
        <input name="department" placeholder="Department" required className="input-field" />
        <input name="year" type="number" placeholder="Year" required className="input-field" />
        <select name="semester" required className="input-field">
          <option value="">Semester</option>
          <option value="Fall">Fall</option>
          <option value="Spring">Spring</option>
          <option value="Summer">Summer</option>
        </select>
        <select name="exam_type" required className="input-field">
          <option value="">Exam Type</option>
          <option value="Midterm">Midterm</option>
          <option value="Final">Final</option>
          <option value="Quiz">Quiz</option>
        </select>
      </div>

      <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" required className="input-field" />

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Uploading…" : "Upload Paper"}
      </button>

      {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
    </form>
  );
}
