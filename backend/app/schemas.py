from enum import Enum
from pydantic import BaseModel, field_validator


class PipelineStep(str, Enum):
    SEARCH = "SEARCH"
    SCRAPE = "SCRAPE"
    WRITE = "WRITE"
    CRITIC = "CRITIC"
    COMPLETE = "COMPLETE"


class MessageType(str, Enum):
    LOG = "LOG"
    RESULT = "RESULT"
    ERROR = "ERROR"


class ResearchRequest(BaseModel):
    topic: str

    @field_validator("topic")
    @classmethod
    def topic_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("topic must be a non-empty string")
        return v.strip()


class StreamMessage(BaseModel):
    step: PipelineStep
    type: MessageType
    content: str