from dotenv import load_dotenv
import os
import certifi

load_dotenv()

os.environ["SSL_CERT_FILE"]=certifi.where()
os.environ["REQUESTS_CA_BUNDLE"]=certifi.where()

import json
import uuid
from pathlib import Path
from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default"
    model: str = "openai/gpt-oss-120b"
    effort: str = "medium"
    api_keys:dict[str, str] | None=None

class RenameRequest(BaseModel):
    title:str 

import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from langchain_core.messages import HumanMessage, AIMessage, AIMessageChunk, ToolMessage
from starlette.middleware.sessions import SessionMiddleware
from agents import get_agent,delete_thread_checkpoints
from database import chat_history, init_db, save_chat, create_or_update_convo, list_convo, rename_convo, delete_convo
from auth import router as auth_router, get_current_user
from rag import add_document_rag
from tools import set_current_context

app=FastAPI()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", FRONTEND_URL,],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "super-secret-dev-key"))

app.include_router(auth_router)



Path("uploads").mkdir(exist_ok=True)
Path("data").mkdir(exist_ok=True)

init_db()

@app.api_route("/", methods=["GET", "HEAD"])
async def home():
    return {"status": "online", "service": "Gareith Agentic AI Backend"}


@app.get("/conversations")
async def conversations(user:dict=Depends(get_current_user)):
    items=list_convo(user_id=user["user_id"])

    return {
        "conversations":[
            {
                "thread_id":item.thread_id,
                "title":item.title,
                "created_at":item.created_at.isoformat(),
                "updated_at":item.updated_at.isoformat()
            }
            for item in items
        ]
    }


@app.get("/history/{thread_id}")
async def history(thread_id:str):
    messages=chat_history(thread_id)

    return {
        "messages":[
            {
                "role":msg.role,
                "content":msg.content
            }
            for msg in messages
        ]
    }


@app.post("/upload")
async def upload_doc(file:UploadFile=File(...), thread_id:str=Form(...), user:dict=Depends(get_current_user)):
    try:
        allowed_extensions=[".pdf", ".docx", ".txt", ".md", ".py", ".csv"]

        filename=file.filename or "uploaded_file"
        suffix=Path(filename).suffix.lower()

        if suffix not in allowed_extensions:
            return JSONResponse(
                {
                    "success":False,
                    "message": "unsupported file type. Upload file PDF, DOCX, TXT, MD, PY, CSV."
                },
                status_code=400
            )
        file_id=str(uuid.uuid4())
        safe_filename=filename.replace(" ", "_")
        file_path=f"uploads/{file_id}_{safe_filename}"

        with open(file_path, "wb") as f:
            f.write(await file.read())

        create_or_update_convo(thread_id, user["user_id"],"uploaded_document")

        result=add_document_rag(
            file_path=file_path,
            thread_id=thread_id
        )

        return JSONResponse(
            {
                "success":True,
                "message":f"uploaded{result['filename']} and created {result['chunks']} chunks."
            }
        )

    except Exception as e:
        return JSONResponse({
            "success":False,
            "message":str(e)
        }, status_code=500)

def sse_data(payload:dict)->str:
    return f"data:{json.dumps(payload, ensure_ascii=False)}\n\n"

def should_stream_chunk(chunk, metadata)->bool:
    """
    this prevents raw tools/search/rag JSON form appearing in the frontend.
    We only stream normal AI text chunks.
    We do not stream:
    -tool message
    -message from tool nodes
    -tool call chunks
    -raw tool outputs
    """

    metadata= metadata or {}
    node_name=str(metadata.get("langgraph_node", "")).lower()

    if "tool" in node_name:
        return False
    if isinstance(chunk, ToolMessage):
        return False
    if not isinstance(chunk, (AIMessage, AIMessageChunk)):
        return False
    if getattr(chunk, "tool_calls", None):
        return False
    if getattr(chunk, "invalid_tool_calls", None):
        return False
    additional_kwargs=getattr(chunk, "additional_kwargs", {}) or {}

    if additional_kwargs.get("tool_calls"):
        return False
    return True

def extract_txt_from_chunk(chunk)->str:
    content=getattr(chunk, "content", "")

    if not content:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts=[]

        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
            elif isinstance(item, dict):
                if item.get("type")=="text" and isinstance(item.get("text"), str):
                    text_parts.append(item["text"])
                elif isinstance(item.get("text"), str):
                    text_parts.append(item["text"])
                elif isinstance(item.get("content"), str):
                    text_parts.append(item["content"])

        return "".join(text_parts)
    return ""

@app.post("/chat/stream")
async def chat_stream(data:ChatRequest, user:dict=Depends(get_current_user)):

    user_message=data.message
    thread_id=data.thread_id
    selected_model=data.model
    user_id=user["user_id"]


    if not user_message.strip():
        return JSONResponse(
            {"error":"Message is required"},
            status_code=400
        )
    try:
        agent=get_agent(selected_model, data.api_keys, data.effort   )
    except ValueError as e:
        async def error_stream():
            yield sse_data({"token":f"⚠️ **Configuration Error:** {str(e)}"})
        return StreamingResponse(error_stream(), media_type="text/event-stream")
    create_or_update_convo(thread_id, user_id, user_message)
    save_chat(thread_id, "user", user_message)
    set_current_context(thread_id=thread_id, user_id=user_id)

    config={
        "configurable":{
            "thread_id":thread_id
        },
        "recursion_limit":6,
    }

    def event_generator():
        final_answer=""

        try:
            inputs={
                "messages":[
                    HumanMessage(content=user_message)
                ]
            }
            for chunk, metadata in agent.stream(
                inputs,
                config=config,
                stream_mode="messages"
            ):
                if not should_stream_chunk(chunk, metadata):
                    continue
                token=extract_txt_from_chunk(chunk)

                if token:
                    final_answer+=token
                    yield sse_data({"token":token})

            if final_answer.strip():
                save_chat(thread_id, "assistant", final_answer)

            yield sse_data({"done":True})

        except Exception as e:
            yield sse_data({"error":str(e)})
            yield sse_data({"done":True})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "cache-control":"no-cache",
            "connection":"keep-alive",
            "X-Accel-Buffering":"no"
        }
    )


@app.patch("/conversations/{thread_id}")
async def rename_conversation_route(thread_id:str, data:RenameRequest, user:dict=Depends(get_current_user)):
    updated=rename_convo(thread_id, user["user_id"], data.title)
    if not updated:
        return JSONResponse({"error":"Conversation not found"}, status_code=404)
    return {"success":True, "thread_id":thread_id, "title":data.title.strip()}

@app.delete("/conversations/{thread_id}")
async def delete_conversation_route(thread_id:str, user:dict=Depends(get_current_user)):
    deleted=delete_convo(thread_id, user["user_id"])
    if not deleted:
        return JSONResponse({"error":"Conversation not found"}, status_code=404)
    delete_thread_checkpoints(thread_id)
    return {"success":True, "thread_id":thread_id} 
                              



    