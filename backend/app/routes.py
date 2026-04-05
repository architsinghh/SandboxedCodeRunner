import asyncio

from fastapi import APIRouter, HTTPException

from app.models import (
    ExecuteRequest,
    ExecuteResponse,
    JudgeRequest,
    JudgeResponse,
    TestCaseResult,
)
from app.executor import execute_code

router = APIRouter()

SUPPORTED_LANGUAGES = {"python", "javascript", "cpp", "java"}


def _validate_language(language: str):
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {language}. Supported: {', '.join(SUPPORTED_LANGUAGES)}",
        )


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.post("/execute", response_model=ExecuteResponse)
async def execute(request: ExecuteRequest):
    _validate_language(request.language)

    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    result = await execute_code(request.code, request.language, request.stdin)
    return result


@router.post("/judge", response_model=JudgeResponse)
async def judge(request: JudgeRequest):
    _validate_language(request.language)

    if not request.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    if not request.test_cases:
        raise HTTPException(status_code=400, detail="At least one test case is required")

    # Run all test cases concurrently
    tasks = [
        execute_code(request.code, request.language, tc.input)
        for tc in request.test_cases
    ]
    raw_results = await asyncio.gather(*tasks)

    results = []
    for i, (tc, raw) in enumerate(zip(request.test_cases, raw_results)):
        actual = raw["stdout"].rstrip("\n")
        expected = tc.expected_output.rstrip("\n")
        results.append(
            TestCaseResult(
                test_number=i + 1,
                passed=actual == expected,
                actual_output=raw["stdout"],
                expected_output=tc.expected_output,
                stderr=raw["stderr"],
                execution_time=raw["execution_time"],
            )
        )

    return JudgeResponse(
        results=results,
        total_passed=sum(1 for r in results if r.passed),
        total_cases=len(results),
    )
