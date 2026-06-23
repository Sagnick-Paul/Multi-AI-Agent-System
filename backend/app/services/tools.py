from httpcore import request
from langchain.tools import tool
import requests
from bs4 import BeautifulSoup
from tavily import TavilyClient
import os
from dotenv import load_dotenv, find_dotenv
from rich import print

load_dotenv(find_dotenv())
tavily_client = TavilyClient(api_key=os.getenv('TAVILY_API_KEY'))

@tool
def web_search(query: str) -> str:
    """search the web for recent and reliable information based on the topic query
    returns title, urls, snippets
    """
    results = tavily_client.search(query=query,max_results=5)
    out=[]

    for r in results['results']:
        out.append(f"Title: {r['title']}\n URL : {r['url']}\n Snippet : {r['content'][:300]}\n")

    return "\n----------\n".join(out)

# print(web_search.invoke("News about iran iarael war"))

@tool
def scrape_url(url : str) -> str:
    """Scrape and return clean text content from a given URL for deeper reading."""
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        return soup.get_text(separator=" ", strip=True)[:3000]
    except Exception as e:
        return f"Could not scrape URL: {str(e)}"

