import asyncio
import re
from typing import AsyncGenerator

from backend.app.schemas import StreamMessage, PipelineStep, MessageType
from backend.app.services.agents import (
    build_search_agent,
    build_reader_agent,
    writer_chain,
    critic_chain,
)


def _emit(step: PipelineStep, msg_type: MessageType, content: str) -> str:
    """Serialize a StreamMessage to the SSE data line format."""
    msg = StreamMessage(step=step, type=msg_type, content=content)
    return f"data: {msg.model_dump_json()}\n\n"


def _extract_message_text(agent_result: dict) -> str:
    """
    Extract the final assistant text from a create_agent result.

    The existing agents.py uses langchain.agents.create_agent which returns
    a dict shaped like {"messages": [HumanMessage, AIMessage, ...]}.
    The final assistant content is at result["messages"][-1].content.
    """
    messages = agent_result.get("messages") or []
    if not messages:
        return ""
    last = messages[-1]
    # AIMessage.content may be a str or a list of content blocks (OpenAI-style).
    content = getattr(last, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text", ""))
            else:
                parts.append(str(block))
        return "\n".join(p for p in parts if p)
    return str(content)


def _extract_first_url(text: str) -> str:
    """Find the first http(s) URL in the given text."""
    match = re.search(r"https?://[^\s)\]\"'>]+", text)
    return match.group(0) if match else ""


async def run_async_research_pipeline(topic: str) -> AsyncGenerator[str, None]:
    """
    Full 4-step research pipeline as an async generator.
    Each yield is a fully-formed SSE data line string conforming to StreamMessage.
    """
    try:
        # ── STEP 1: SEARCH ──────────────────────────────────────────────────
        yield _emit(
            PipelineStep.SEARCH,
            MessageType.LOG,
            f"Initializing search agent for topic: '{topic}'",
        )

        try:
            search_agent = build_search_agent()
            search_result = await asyncio.to_thread(
                search_agent.invoke,
                {"messages": [("user", f"Find recent, reliable and detailed information about: {topic}")]},
            )
            search_text = _extract_message_text(search_result)
        except Exception as e:
            await asyncio.sleep(0)  # allow event loop to process
            yield _emit(PipelineStep.SEARCH, MessageType.ERROR, f"Search agent error: {e}")
            search_text = ""

        if not search_text:
            # Emit error and abort pipeline
            yield _emit(PipelineStep.SEARCH, MessageType.ERROR, "Search failed: no results retrieved.")
            # Emit COMPLETE error to close stream gracefully
            yield _emit(PipelineStep.COMPLETE, MessageType.ERROR, "Pipeline aborted due to search failure.")
            return


        # ── STEP 2: SCRAPE ──────────────────────────────────────────────────
        yield _emit(
            PipelineStep.SCRAPE,
            MessageType.LOG,
            "Parsing search results to extract best URL...",
        )

        best_url = _extract_first_url(search_text)

        if not best_url:
            yield _emit(
                PipelineStep.SCRAPE,
                MessageType.ERROR,
                "No valid URL found in search results. Skipping scrape.",
            )
            scraped_content = search_text[:800]
        else:
            yield _emit(
                PipelineStep.SCRAPE,
                MessageType.LOG,
                f"Scraping content from: {best_url}",
            )
            try:
                reader_agent = build_reader_agent()
                reader_result = await asyncio.to_thread(
                    reader_agent.invoke,
                    {
                        "messages": [
                            (
                                "user",
                                f"Based on the following search results about '{topic}', "
                                f"pick the most relevant URL and scrape it for deeper content.\n\n"
                                f"Search Results:\n{search_text[:800]}",
                            )
                        ]
                    },
                )
                scraped_content = _extract_message_text(reader_result)
                yield _emit(
                    PipelineStep.SCRAPE, MessageType.LOG,
                    "Page content successfully scraped.",
                )
            except Exception as e:
                await asyncio.sleep(0)
                yield _emit(PipelineStep.SCRAPE, MessageType.ERROR, f"Scrape agent error: {e}")
                scraped_content = ""

        if not scraped_content:
            # Emit error and abort pipeline
            yield _emit(PipelineStep.SCRAPE, MessageType.ERROR, "Scrape failed: unable to retrieve content.")
            # Emit COMPLETE error to close stream gracefully
            yield _emit(PipelineStep.COMPLETE, MessageType.ERROR, "Pipeline aborted due to scrape failure.")
            return

        # ── STEP 3: WRITE ───────────────────────────────────────────────────
        yield _emit(
            PipelineStep.WRITE,
            MessageType.LOG,
            "Drafting research report from gathered sources...",
        )

        try:
            # Writer step
            combined_research = (
                f"SEARCH RESULTS:\n{search_text}\n\n"
                f"SCRAPED CONTENT:\n{scraped_content}\n\n"
            )
            # writer_chain is a Runnable ending in StrOutputParser, so it returns a str.
            final_report: str = await asyncio.to_thread(
                writer_chain.invoke,
                {"topic": topic, "research": combined_research},
            )
            # If writer failed, function already raised and exited.
            yield _emit(PipelineStep.WRITE, MessageType.LOG, "Report drafted successfully.")
            yield _emit(PipelineStep.WRITE, MessageType.RESULT, final_report)
        except Exception as e:
            await asyncio.sleep(0)
            yield _emit(PipelineStep.WRITE, MessageType.ERROR, f"Writer agent error: {e}")
            # Emit COMPLETE error to close stream gracefully
            yield _emit(PipelineStep.COMPLETE, MessageType.ERROR, "Pipeline aborted due to writer failure.")
            return

        # ── STEP 4: CRITIC ──────────────────────────────────────────────────
        yield _emit(
            PipelineStep.CRITIC,
            MessageType.LOG,
            "Passing report to critic agent for evaluation...",
        )

        try:
            # Critic step
            final_feedback: str = await asyncio.to_thread(
                critic_chain.invoke,
                {"report": final_report},
            )
            # If critic failed, function already raised and exited.
            yield _emit(PipelineStep.CRITIC, MessageType.LOG, "Critic evaluation complete.")
            yield _emit(PipelineStep.CRITIC, MessageType.RESULT, final_feedback)
        except Exception as e:
            await asyncio.sleep(0)
            yield _emit(PipelineStep.CRITIC, MessageType.ERROR, f"Critic agent error: {e}")
            # Emit COMPLETE error to close stream gracefully
            yield _emit(PipelineStep.COMPLETE, MessageType.ERROR, "Pipeline aborted due to critic failure.")
            return

        # ── COMPLETE ────────────────────────────────────────────────────────
        yield _emit(
            PipelineStep.COMPLETE,
            MessageType.LOG,
            "Pipeline finished. All steps complete.",
        )

    except Exception as exc:
        yield _emit(
            PipelineStep.COMPLETE,
            MessageType.ERROR,
            f"Pipeline error: {exc}",
        )