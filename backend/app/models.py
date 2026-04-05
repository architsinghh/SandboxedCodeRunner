from pydantic import BaseModel, Field


class ExecuteRequest(BaseModel):
    code: str = Field(..., description="Source code to execute")
    language: str = Field(..., description="Language: python, javascript, or cpp")
    stdin: str | None = Field(None, description="Optional stdin input")


class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    execution_time: float
    exit_code: int


class TestCase(BaseModel):
    input: str = Field(..., description="Stdin input for the test case")
    expected_output: str = Field(..., description="Expected stdout output")


class JudgeRequest(BaseModel):
    code: str = Field(..., description="Source code to execute")
    language: str = Field(..., description="Language: python, javascript, or cpp")
    test_cases: list[TestCase] = Field(..., description="List of test cases to run")


class TestCaseResult(BaseModel):
    test_number: int
    passed: bool
    actual_output: str
    expected_output: str
    stderr: str
    execution_time: float


class JudgeResponse(BaseModel):
    results: list[TestCaseResult]
    total_passed: int
    total_cases: int
