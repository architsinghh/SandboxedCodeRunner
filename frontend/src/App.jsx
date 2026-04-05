import { useState, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { executeCode, judgeCode } from "./api";
import "./App.css";

const LANGUAGES = [
  { value: "python", label: "Python", monacoId: "python" },
  { value: "cpp", label: "C++", monacoId: "cpp" },
  { value: "java", label: "Java", monacoId: "java" },
  { value: "javascript", label: "JavaScript", monacoId: "javascript" },
];

const DEFAULT_CODE = {
  python: `# Python 3\nprint("Hello, World!")\n\nfor i in range(5):\n    print(f"Number: {i}")`,
  javascript: `// Node.js\nconsole.log("Hello, World!");\n\nfor (let i = 0; i < 5; i++) {\n  console.log(\`Number: \${i}\`);\n}`,
  cpp: `// C++\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    for (int i = 0; i < 5; i++) {\n        cout << "Number: " << i << endl;\n    }\n    return 0;\n}`,
  java: `// Java\nimport java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n        for (int i = 0; i < 5; i++) {\n            System.out.println("Number: " + i);\n        }\n    }\n}`,
};

const EMPTY_TEST_CASE = { input: "", expectedOutput: "" };

// Parse line numbers from stderr for different languages
function parseErrorLines(stderr, language) {
  if (!stderr) return [];
  const lines = [];
  const patterns = {
    python: /File ".*?", line (\d+)/g,
    javascript: /main\.js:(\d+)/g,
    cpp: /main\.cpp:(\d+):\d+: error/g,
    java: /Main\.java:(\d+): error/g,
  };
  const pattern = patterns[language];
  if (!pattern) return [];
  let match;
  while ((match = pattern.exec(stderr)) !== null) {
    const lineNum = parseInt(match[1], 10);
    if (lineNum > 0 && !lines.includes(lineNum)) {
      lines.push(lineNum);
    }
  }
  return lines;
}

function App() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_CODE.python);
  const [stdin, setStdin] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Judge mode state
  const [judgeMode, setJudgeMode] = useState(false);
  const [testCases, setTestCases] = useState([{ ...EMPTY_TEST_CASE }]);
  const [judgeResult, setJudgeResult] = useState(null);

  // Monaco editor ref for error decorations
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  const clearDecorations = useCallback(() => {
    if (editorRef.current) {
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        []
      );
    }
  }, []);

  const setErrorDecorations = useCallback((errorLines) => {
    if (!editorRef.current || errorLines.length === 0) return;
    const decorations = errorLines.map((line) => ({
      range: {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: "error-line-highlight",
        glyphMarginClassName: "error-glyph",
      },
    }));
    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, []);

  const handleEditorMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  const handleLanguageChange = useCallback((e) => {
    const lang = e.target.value;
    setLanguage(lang);
    setCode(DEFAULT_CODE[lang]);
    setStdin("");
    setResult(null);
    setJudgeResult(null);
    setError(null);
    clearDecorations();
  }, [clearDecorations]);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setJudgeResult(null);
    clearDecorations();

    try {
      if (judgeMode) {
        const validCases = testCases.filter(
          (tc) => tc.input.trim() !== "" || tc.expectedOutput.trim() !== ""
        );
        if (validCases.length === 0) {
          throw new Error("Add at least one test case");
        }
        const missingOutput = validCases.some(
          (tc) => tc.expectedOutput.trim() === ""
        );
        if (missingOutput) {
          throw new Error("All test cases must have an expected output");
        }
        const res = await judgeCode(code, language, validCases);
        setJudgeResult(res);

        // Highlight errors from first failing test case
        const firstFailed = res.results.find((r) => !r.passed && r.stderr);
        if (firstFailed) {
          setErrorDecorations(parseErrorLines(firstFailed.stderr, language));
        }
      } else {
        const res = await executeCode(code, language, stdin);
        setResult(res);

        // Highlight error lines if stderr has line info
        if (res.stderr && res.exit_code !== 0) {
          setErrorDecorations(parseErrorLines(res.stderr, language));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [code, language, stdin, judgeMode, testCases, clearDecorations, setErrorDecorations]);

  const handleToggleMode = useCallback(() => {
    setJudgeMode((prev) => !prev);
    setResult(null);
    setJudgeResult(null);
    setError(null);
    clearDecorations();
  }, [clearDecorations]);

  const updateTestCase = useCallback((index, field, value) => {
    setTestCases((prev) =>
      prev.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc))
    );
  }, []);

  const addTestCase = useCallback(() => {
    setTestCases((prev) => [...prev, { ...EMPTY_TEST_CASE }]);
  }, []);

  const removeTestCase = useCallback((index) => {
    setTestCases((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const monacoLang = LANGUAGES.find((l) => l.value === language)?.monacoId;

  return (
    <div className="app">
      <header className="header">
        <h1>&#9654; Code Sandbox</h1>
        <div className="header-controls">
          <button
            className={`mode-toggle ${judgeMode ? "active" : ""}`}
            onClick={handleToggleMode}
          >
            {judgeMode ? "Judge Mode" : "Run Mode"}
          </button>
          <select
            className="language-select"
            value={language}
            onChange={handleLanguageChange}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <button
            className="run-btn"
            onClick={handleRun}
            disabled={loading || !code.trim()}
          >
            {loading ? "Running..." : judgeMode ? "Judge" : "Run"}
          </button>
        </div>
      </header>

      <div className="main">
        <div className="editor-panel">
          <div className="panel-header">Editor</div>
          <div className="editor-wrapper">
            <Editor
              height="100%"
              language={monacoLang}
              value={code}
              onChange={(value) => setCode(value || "")}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                lineNumbersMinChars: 3,
                automaticLayout: true,
                glyphMargin: true,
              }}
            />
          </div>

          {/* Stdin input in Run mode */}
          {!judgeMode && (
            <div className="stdin-section">
              <div className="panel-header">Input (stdin)</div>
              <textarea
                className="stdin-input"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Program input (stdin)..."
                rows={3}
              />
            </div>
          )}
        </div>

        <div className="output-panel">
          {/* Test Cases Panel (Judge Mode only) */}
          {judgeMode && (
            <div className="test-cases-section">
              <div className="panel-header test-cases-header">
                <span>Test Cases</span>
                <button className="add-test-btn" onClick={addTestCase}>
                  + Add
                </button>
              </div>
              <div className="test-cases-list">
                {testCases.map((tc, i) => (
                  <div key={i} className="test-case-item">
                    <div className="test-case-number">
                      <span>#{i + 1}</span>
                      {testCases.length > 1 && (
                        <button
                          className="remove-test-btn"
                          onClick={() => removeTestCase(i)}
                        >
                          x
                        </button>
                      )}
                    </div>
                    <div className="test-case-fields">
                      <div className="test-case-field">
                        <label>Input</label>
                        <textarea
                          value={tc.input}
                          onChange={(e) => updateTestCase(i, "input", e.target.value)}
                          placeholder="stdin input..."
                          rows={2}
                        />
                      </div>
                      <div className="test-case-field">
                        <label>Expected Output</label>
                        <textarea
                          value={tc.expectedOutput}
                          onChange={(e) =>
                            updateTestCase(i, "expectedOutput", e.target.value)
                          }
                          placeholder="Expected stdout..."
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output Header */}
          <div className="panel-header">
            {judgeMode ? "Results" : "Output"}
          </div>

          {loading && (
            <div className="loading">
              <div className="spinner" />
              <span>{judgeMode ? "Judging test cases..." : "Executing code..."}</span>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}

          {/* Run Mode Output */}
          {!judgeMode && result && !loading && (
            <>
              <div className="output-content">
                {result.stdout && (
                  <div className="output-section">
                    <div className="output-label">stdout</div>
                    <div className="output-text stdout">{result.stdout}</div>
                  </div>
                )}
                {result.stderr && (
                  <div className="output-section">
                    <div className="output-label">stderr</div>
                    <div className="output-text stderr">{result.stderr}</div>
                  </div>
                )}
                {!result.stdout && !result.stderr && (
                  <div className="placeholder">No output</div>
                )}
              </div>
              <div className="execution-time">
                <span>Time: {result.execution_time}s</span>
                <span
                  className={`exit-code ${result.exit_code === 0 ? "success" : "error"}`}
                >
                  Exit code: {result.exit_code}
                </span>
              </div>
            </>
          )}

          {/* Judge Mode Results */}
          {judgeMode && judgeResult && !loading && (
            <>
              <div className="judge-summary">
                <span
                  className={
                    judgeResult.total_passed === judgeResult.total_cases
                      ? "all-passed"
                      : "some-failed"
                  }
                >
                  {judgeResult.total_passed}/{judgeResult.total_cases} passed
                </span>
              </div>
              <div className="judge-results">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Status</th>
                      <th>Expected</th>
                      <th>Actual</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {judgeResult.results.map((r) => (
                      <tr key={r.test_number} className={r.passed ? "passed" : "failed"}>
                        <td>{r.test_number}</td>
                        <td className="status-cell">
                          {r.passed ? (
                            <span className="status-pass">Pass</span>
                          ) : (
                            <span className="status-fail">Fail</span>
                          )}
                        </td>
                        <td>
                          <pre className="cell-output">{r.expected_output}</pre>
                        </td>
                        <td>
                          <pre className="cell-output">{r.actual_output}</pre>
                          {r.stderr && (
                            <pre className="cell-stderr">{r.stderr}</pre>
                          )}
                        </td>
                        <td className="time-cell">{r.execution_time}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Placeholder */}
          {!result && !judgeResult && !loading && !error && (
            <div className="placeholder">
              {judgeMode
                ? 'Add test cases and click "Judge"'
                : 'Click "Run" to execute your code'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
