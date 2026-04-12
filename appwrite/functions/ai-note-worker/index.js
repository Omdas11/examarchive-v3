function parseJobPayload(rawBody) {
  const raw = `${rawBody || ""}`.trim();
  if (!raw) return { jobId: "" };
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : { jobId: "" };
  } catch {
    return { jobId: "" };
  }
}

function normalizeBaseUrl(value) {
  const raw = `${value || ""}`.trim();
  if (!raw) return "https://www.examarchive.dev";
  return raw.replace(/\/+$/, "");
}

module.exports = async ({ req, res, log, error }) => {
  const payload = parseJobPayload(req?.body);
  const jobId = typeof payload.jobId === "string" ? payload.jobId.trim() : "";
  if (!jobId) {
    return res.json({ ok: false, error: "Missing jobId in execution payload." }, 400);
  }

  const baseUrl = normalizeBaseUrl(process.env.EXAMARCHIVE_BASE_URL);
  const workerKey = `${process.env.EXAMARCHIVE_WORKER_SHARED_SECRET || ""}`.trim();
  if (!workerKey) {
    error("Missing EXAMARCHIVE_WORKER_SHARED_SECRET variable.");
    return res.json({ ok: false, error: "Worker shared secret is not configured." }, 500);
  }

  const endpoint = `${baseUrl}/api/ai/jobs/execute`;
  log(`Dispatching ai-note-worker job ${jobId} to ${endpoint}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-key": workerKey,
    },
    body: JSON.stringify({ jobId }),
  });

  if (!response.ok) {
    const text = (await response.text()).slice(0, 500);
    error(`Worker dispatch failed (${response.status}): ${text}`);
    return res.json(
      { ok: false, error: "Failed to dispatch job to website worker endpoint.", status: response.status },
      502,
    );
  }

  return res.json({ ok: true, jobId }, 200);
};
