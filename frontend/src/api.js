const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function executeCode(code, language, stdin = "") {
  const response = await fetch(`${API_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, stdin: stdin || undefined }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function judgeCode(code, language, testCases) {
  const response = await fetch(`${API_URL}/judge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      language,
      test_cases: testCases.map((tc) => ({
        input: tc.input,
        expected_output: tc.expectedOutput,
      })),
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}
