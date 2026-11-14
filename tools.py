import math
import os
import re
from dotenv import load_dotenv
from langchain_core.tools import tool
from langchain_tavily import TavilySearch
from database import save_memory, search_memory
from rag import retrival_from_rag
from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import YouTubeTranscriptApi
import trafilatura
import yfinance as yf
from pathlib import Path
import uuid

load_dotenv(override=True)

CURRENT_THREAT_ID="default"
CURRENT_USER_ID=None

def set_current_context(thread_id:str, user_id:int):
    global CURRENT_THREAT_ID, CURRENT_USER_ID
    CURRENT_THREAT_ID=thread_id
    CURRENT_USER_ID=user_id

@tool
def web_search(query:str)->str:
    """Search the live web for current events, latest news, real-time information, and recent updates."""
    try:
        api_key = os.getenv("TAVILY_API_KEY", "").strip().strip('"').strip("'")
        if not api_key:
            return "Error: TAVILY_API_KEY is missing in your .env file."

        tavily = TavilySearch(max_results=3, topic="general", tavily_api_key=api_key)
        raw = tavily.invoke({"query": query})

        items = raw.get("results", []) if isinstance(raw, dict) else []
        if not items:
            return str(raw)[:3000]

        formatted = []
        for item in items[:3]:
            title = item.get("title", "No title")
            url = item.get("url", "")
            content = item.get("content", "")[:400]
            formatted.append(f"- {title} ({url}): {content}")

        return (
            "WEB SEARCH RESULTS:\n"
            + "\n".join(formatted)
            + "\n\n[SYSTEM INSTRUCTION: Search is complete. Do NOT call web_search again. Answer the user's question now using the results above.]"
        )
    except Exception as e:
        print(f"[WEB SEARCH ERROR]: {e}")
        return f"Web search error: {str(e)}. Do NOT retry the search; inform the user."

@tool
def calculator(expression: str) -> str:
    """
    Useful for simple math calculations.
    Input should be a valid math expression.
    Example: 2 + 2, math.sqrt(16), 10 * 5
    """

    try:
        allowed = {
            "math": math,
            "abs": abs,
            "round": round,
            "min": min,
            "max": max,
            "sum": sum
        }

        result = eval(expression, {"__builtins__": {}}, allowed)
        return str(result)

    except Exception as e:
        return f"Calculation error: {str(e)}"


@tool
def remember_this(memory:str):
    """Save a important user information or fact into long term memory.Use this when user asks you to remember something"""

    if not CURRENT_USER_ID:
        return "Error: User not logged in"

    return save_memory(user_id=CURRENT_USER_ID, memory=memory)

@tool
def get_from_doc(query:str):
    """Search uplaoded documents for relevent information. Use this when the user asks about the uploaded PDFs, DOCX, TXT, notes, files, or documents."""

    return retrival_from_rag(
        query=query,
        thread_id=CURRENT_THREAT_ID
    )


@tool
def recall_memory(query:str):
    """Recall saved long term memories about the user or this conversation"""

    if not CURRENT_USER_ID:
        return "Error: User not logged in"

    return search_memory(user_id=CURRENT_USER_ID, query=query)

@tool
def get_youtube_transcript(video_url: str) -> str:
    """Extract the full text transcript of a YouTube video from its URL. Use this when a user shares a YouTube link and wants a summary, notes, or answers about the video."""
    try:
        match = re.search(r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})", video_url)
        if not match:
            return "Invalid YouTube URL. Could not extract video ID."
        video_id = match.group(1)

        if hasattr(YouTubeTranscriptApi, "get_transcript"):
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            full_text = " ".join([entry["text"] for entry in transcript_list])
        else:
            ytt_api = YouTubeTranscriptApi()
            fetched = ytt_api.fetch(video_id)
            full_text = " ".join([snippet.text for snippet in fetched])

        return full_text[:12000] if full_text else "Transcript was empty."
    except Exception as e:
        print(f"[YOUTUBE TOOL ERROR]: {e}")
        return f"Could not fetch transcript: {str(e)}"


@tool
def scrape_website(url: str) -> str:
    """Scrape and read the main text content of any specific webpage URL provided by the user."""
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return "Failed to download the webpage."
        text = trafilatura.extract(downloaded)
        return text[:10000] if text else "No readable text found on this page."
    except Exception as e:
        return f"Scraping error: {str(e)}"


@tool
def get_stock_price(ticker: str) -> str:
    """Get the current stock/crypto price, 52-week high/low, and market summary for a ticker symbol (e.g., 'AAPL', 'TSLA', 'BTC-USD', 'RELIANCE.NS')."""
    try:
        stock = yf.Ticker(ticker.upper())
        info = stock.fast_info
        return (
            f"Ticker: {ticker.upper()}\n"
            f"Current Price: {info.last_price:.2f} {info.currency}\n"
            f"Day High: {info.day_high:.2f} | Day Low: {info.day_low:.2f}\n"
            f"52-Week High: {info.year_high:.2f} | 52-Week Low: {info.year_low:.2f}"
        )
    except Exception as e:
        return f"Could not fetch data for ticker '{ticker}': {str(e)}"


Path("exports").mkdir(exist_ok=True)

@tool
def create_downloadable_file(filename: str, content: str) -> str:
    """Create a downloadable file (.txt, .md, .py, .csv) with the given content when the user asks to save, export, or generate a file."""
    safe_name = f"{uuid.uuid4().hex[:6]}_{Path(filename).name}"
    filepath = Path("exports") / safe_name
    filepath.write_text(content, encoding="utf-8")
    return f"File created successfully at /exports/{safe_name}. Tell the user they can download it."


import urllib.parse
import random

@tool
def generate_image(prompt: str, aspect_ratio: str = "1:1") -> str:
    """
    Generate a high-quality AI image from a detailed text description.
    Use this whenever the user asks to draw, create, generate, or design an image, picture, photo, logo, or artwork.
    aspect_ratio can be '1:1' (square), '16:9' (landscape), or '9:16' (portrait/reel).
    """
    dimensions = {
        "1:1": (1024, 1024),
        "16:9": (1280, 720),
        "9:16": (720, 1280),
    }
    width, height = dimensions.get(aspect_ratio, (1024, 1024))
    seed = random.randint(1, 999999999)
    encoded_prompt = urllib.parse.quote(prompt)

    image_url = (
        f"https://image.pollinations.ai/prompt/{encoded_prompt}"
        f"?width={width}&height={height}&seed={seed}&model=flux&nologo=true&enhance=true"
    )

    return (
        f"IMAGE_GENERATED_SUCCESSFULLY\n"
        f"You MUST include this exact markdown in your final reply so the user can see the image:\n"
        f"![{prompt}]({image_url})"
    )

tools=[
    calculator,
    get_from_doc,
    remember_this,
    recall_memory,
    get_youtube_transcript,
    scrape_website,
    get_stock_price,
    generate_image,
    web_search,
]