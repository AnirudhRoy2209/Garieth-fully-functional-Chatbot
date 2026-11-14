import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv
import certifi
import tools as tools_module
from tools import tools
from database import search_memory
from datetime import datetime

load_dotenv()

os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.sqlite import SqliteSaver

Path("data").mkdir(exist_ok=True)

DEFAULT_MODEL = "openai/gpt-oss-120b"

ALLOWED_MODELS = {
    # Groq Cloud models
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    # Google Gemini BYOK models
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    # OpenAI BYOK models
    "gpt-4o",
    "gpt-4o-mini",
    "o3-mini",
    # Anthropic Claude BYOK models
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
}

SYSTEM_PROMPT = """
You are a helpful Agentic AI assistant named Gareith similar to ChatGPT.

You can:
1. Answer normal questions.
2. Use tools when needed.
3. Search uploaded documents using the RAG tool (get_from_doc).
4. Search the web for latest/current information using Tavily Search (web_search).
5. Remember important user information using remember_this.
6. Recall memory when useful using recall_memory.
7. Use calculator for math.
8. Generate AI images and artwork using generate_image.
9. Summarize or answer questions about YouTube videos using get_youtube_transcript.
10. Read and extract content from specific webpage URLs using scrape_website.
11. Fetch live stock and crypto prices using get_stock_price.

Rules:
- If the user shares a YouTube link (youtube.com or youtu.be), ALWAYS use get_youtube_transcript.
- If the user shares any other specific webpage URL, ALWAYS use scrape_website.
- If the user asks for a stock or crypto price/ticker, ALWAYS use get_stock_price.
- If the user asks to draw, generate, or create an image, picture, or artwork, ALWAYS use generate_image and include the exact markdown ![prompt](url) in your final response.
- If the user asks about an uploaded document, use get_from_doc.
- If the user asks about latest news or current events without a specific URL, call web_search ONCE, and then immediately answer the user using those results. NEVER call web_search more than once for the same question.
"""

def normalize_model(model_name: str | None) -> str:
    """Validate the selected model from frontend. If not allowed, fallback to default."""
    if not model_name:
        return DEFAULT_MODEL
    model_name = model_name.strip()
    if model_name not in ALLOWED_MODELS:
        return DEFAULT_MODEL
    return model_name


EFFORT_INSTRUCTIONS = {
    "low": "\n\n[EFFORT LEVEL: LOW] Keep your response brief, direct, and concise. Skip unnecessary background.",
    "medium": "\n\n[EFFORT LEVEL: MEDIUM] Provide a balanced, well-structured explanation with clear reasoning.",
    "high": "\n\n[EFFORT LEVEL: HIGH] Perform exhaustive, deep step-by-step analysis. Verify edge cases and provide comprehensive detail.",
    "max": "\n\n[EFFORT LEVEL: MAX] Maximum computational depth, rigorous verification, and complete architectural synthesis.",
}

EFFORT_TEMPERATURES = {
    "low": 0.1,
    "medium": 0.3,
    "high": 0.5,
    "max": 0.6,
}


def create_llm_instance(selected_model: str, api_keys: dict | None = None, effort:str="medium"):
    """
    Selects the right LangChain provider class based on model name prefix.
    Uses custom key from frontend if provided; otherwise falls back to .env key.
    """
    api_keys = api_keys or {}
    temp = EFFORT_TEMPERATURES.get(effort, 0.3)

    if selected_model.startswith("gemini-"):
        key = api_keys.get("google") or os.getenv("GOOGLE_API_KEY")
        if not key:
            raise ValueError("Missing Google API Key. Configure it in the API Keys menu or set GOOGLE_API_KEY in .env.")
        return ChatGoogleGenerativeAI(model=selected_model, google_api_key=key, temperature=temp)

    if selected_model.startswith("gpt-") or selected_model.startswith("o3-"):
        key = api_keys.get("openai") or os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("Missing OpenAI API Key. Configure it in the API Keys menu or set OPENAI_API_KEY in .env.")
        return ChatOpenAI(model=selected_model, api_key=key, temperature=temp, streaming=True)

    if selected_model.startswith("claude-"):
        key = api_keys.get("claude") or os.getenv("ANTHROPIC_API_KEY")
        if not key:
            raise ValueError("Missing Anthropic API Key. Configure it in the API Keys menu or set ANTHROPIC_API_KEY in .env.")
        return ChatAnthropic(model=selected_model, api_key=key, temperature=temp, streaming=True)

    key = api_keys.get("groq") or os.getenv("GROQ_API_KEY")
    if not key:
        raise ValueError("Missing Groq API Key. Configure it in the API Keys menu or set GROQ_API_KEY in .env.")
    return ChatGroq(model=selected_model, api_key=key, temperature=temp, streaming=True)

def build_agent(model_name: str, api_keys: dict | None = None, effort:str="medium"):
    """Build a LangGraph agent for the given model with its dedicated checkpointer."""
    selected_model = normalize_model(model_name)
    effort_key=(effort or "medium").lower()
    llm = create_llm_instance(selected_model, api_keys, effort_key)
    llm_with_tools = llm.bind_tools(tools)

    dynamic_prompt=SYSTEM_PROMPT+EFFORT_INSTRUCTIONS.get(effort_key, EFFORT_INSTRUCTIONS["medium"])

    def chatbot_node(state: MessagesState):
        user_memories = ""
        if tools_module.CURRENT_USER_ID:
            saved = search_memory(user_id=tools_module.CURRENT_USER_ID, query="")
            if saved and saved != "no saved memory found":
                user_memories = f"\n\n[KNOWN FACTS ABOUT THIS USER FROM LONG-TERM MEMORY]:\n{saved}\nAlways use these facts naturally when answering personal questions about the user."

        full_system_prompt = dynamic_prompt + user_memories
        messages = [SystemMessage(content=full_system_prompt)] + state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": response}

    t_node = ToolNode(tools)

    workflow = StateGraph(MessagesState)
    workflow.add_node("chatbot", chatbot_node)
    workflow.add_node("tools", t_node)

    workflow.add_edge(START, "chatbot")
    workflow.add_conditional_edges("chatbot", tools_condition)
    workflow.add_edge("tools", "chatbot")

    conn = sqlite3.connect(
        "data/langgraph_checkpoints.sqlite",
        check_same_thread=False,
    )
    checkpointer = SqliteSaver(conn)

    return workflow.compile(checkpointer=checkpointer)

def get_agent(model_name: str | None = None, api_keys: dict | None = None, effort:str="medium"):
    """
    Returns an agent instance configured for the selected model and keys.
    """
    selected_model = normalize_model(model_name)
    return build_agent(selected_model, api_keys, effort)

def delete_thread_checkpoints(thread_id:str):
    conn=sqlite3.connect("data/langgraph_checkpoints.sqlite", check_same_thread=False,)
    try:
        saver=SqliteSaver(conn)
        saver.delete_thread(thread_id)
    except Exception:
        pass
    finally:
        conn.close()


