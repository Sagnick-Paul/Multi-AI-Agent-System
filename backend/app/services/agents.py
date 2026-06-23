from langchain_mistralai import ChatMistralAI
from langgraph.prebuilt import create_react_agent as create_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from backend.app.services.tools import web_search, scrape_url
import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

#initialize the agent with a prompt template and output parser

llm=ChatMistralAI(model="mistral-small-2506",mistral_api_key=os.getenv("MISTRAL_API_KEY"),temperature=0.7) 

#1st agent
def build_search_agent():
    return create_agent(
        model=llm,
        tools=[web_search]
    )

#2nd agent
def build_reader_agent():
    return create_agent(
        model=llm,
        tools=[scrape_url],
    )

#writer_chain
writer_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert research writer. Write clear, beautifully formatted, and insightful reports using rich Markdown."),
    ("human", """Write a detailed, engaging research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Structure the report with rich Markdown formatting:
# [Catchy Title based on Topic]

## Introduction
[Engaging opening paragraph. Use **bold** for key terms and emphasis.]

## Key Findings
[Present a minimum of 3 findings. Use ### Subheadings for each finding, followed by detailed paragraphs and bullet points where appropriate.]

## Conclusion   
[Strong concluding thoughts summarizing the impact.]

## Sources
[List all URLs as proper markdown links: - [Source Name](URL)]

Ensure the writing is detailed, factual, professional, and visually highly readable. Do not produce a flat text block."""),
])

writer_chain =writer_prompt | llm | StrOutputParser()

#critic chain
critic_prompt = ChatPromptTemplate.from_messages([
     ("system", "You are a sharp and constructive research critic. Provide honest, specific feedback using highly readable Markdown. Evaluate the quality of the report and give a genuine, customized numeric score out of 10."),
    ("human", """Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this exact Markdown format, replacing '<SCORE>' with a real calculated rating from 1 to 10 based on its actual quality (e.g. 5/10, 8/10, etc.):

## 📊 Evaluation Score: **<SCORE>/10**

### 🌟 Strengths
- [Detail strength...]
- [Detail strength...]

### 📈 Areas to Improve
- [Detail area...]
- [Detail area...]

### 💡 One-Line Verdict
> [Insert punchy one-line summary here]"""),
])

critic_chain = critic_prompt | llm | StrOutputParser()
