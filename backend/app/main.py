from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.app.services.pipeline import run_async_research_pipeline


app = FastAPI(title="Multi-Agent Research API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/research/stream")
async def stream_research(
    topic: str = Query(..., min_length=1, description="Research topic"),
):
    """
    Server-Sent Events stream of the full research pipeline.
    Each event line is `data: <StreamMessage JSON>` with fields step/type/content.
    """
    if not topic or not topic.strip():
        raise HTTPException(status_code=422, detail="topic must not be empty")

    return StreamingResponse(
        run_async_research_pipeline(topic.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health_check():
    return {"status": "ok"}