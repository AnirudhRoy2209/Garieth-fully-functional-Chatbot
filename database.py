from datetime import datetime
from pathlib import Path
from sqlalchemy import create_engine, Column, String, Integer, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

Path("data").mkdir(exist_ok=True)

DATABASE_URL = "sqlite:///data/chatbot_memory.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class User(Base):
    __tablename__="User"

    id=Column(Integer, primary_key=True, index=True)
    email=Column(String, unique=True, nullable=False)
    name=Column(String, default="User")
    hashed_password=Column(String, nullable=True)
    auth_provider=Column(String, default="local")
    created_at=Column(DateTime, default=datetime.utcnow())

class conversation(Base):
    __tablename__="conversation"

    id= Column(Integer, primary_key=True, index=True)
    user_id=Column(Integer, index=True)
    thread_id=Column(String, unique=True, index=True)
    title=Column(String, default="New Chat")
    created_at=Column(DateTime, default=datetime.utcnow())
    updated_at=Column(DateTime, default=datetime.utcnow())


class chatmessage(Base):
    __tablename__="chat_messages"

    id=Column(Integer, primary_key=True, index=True)
    thread_id=Column(String, index=True)
    role=Column(String)
    content=Column(Text)
    created_at=Column(DateTime, default=datetime.utcnow())

class longtermmemory(Base):
    __tablename__="long_term_memory"

    id= Column(Integer, primary_key=True, index=True)
    user_id=Column(Integer, index=True)
    memory=Column(Text)
    created_at=Column(DateTime, default=datetime.utcnow())

def init_db():
    Base.metadata.create_all(bind=engine)

def create_or_update_convo(thread_id:str, user_id:int, first_message:str|None=None):
    db=SessionLocal()

    try:
        convo=(
            db.query(conversation).filter(conversation.thread_id==thread_id, conversation.user_id==user_id).first()
        )

        if not convo:
            title="New Chat"

            if first_message:
                title=first_message.strip()[:40]
                if len(first_message.strip())>40:
                    title+="..."
            convo=conversation(thread_id=thread_id, user_id=user_id, title=title, created_at=datetime.utcnow(), updated_at=datetime.utcnow())

            db.add(convo)
        else:
            convo.updated_at=datetime.utcnow()
        db.commit()
    finally:
        db.close()

def list_convo(user_id:int):
    db=SessionLocal()

    try:
        return (
            db.query(conversation).filter(conversation.user_id==user_id).order_by(conversation.updated_at.desc()).all()
        )

    finally:
        db.close()


def save_chat(thread_id:str, role:str, content:str):
    db=SessionLocal()

    try:
        msg= chatmessage(
            thread_id=thread_id, role=role, content=content, created_at=datetime.utcnow()
        )

        db.add(msg)

        convo=(db.query(conversation).filter(conversation.thread_id==thread_id).first())

        if convo:
            convo.updated_at=datetime.utcnow()

        db.commit()

    finally:
        db.close()


def chat_history(thread_id:str):
    db=SessionLocal()

    try:
        return (
            db.query(chatmessage).filter(chatmessage.thread_id==thread_id).order_by(chatmessage.created_at.asc()).all()
        )

    finally:
        db.close()

def save_memory(user_id:int, memory:str):
    db=SessionLocal()

    try:
        item=longtermmemory(user_id=user_id, memory=memory, created_at=datetime.utcnow())

        db.add(item)
        db.commit()

        return "memory saved successfully"
    finally:
        db.close()

def search_memory(user_id:int, query:str):
    db=SessionLocal()

    try:
        memories=db.query(longtermmemory).filter(longtermmemory.user_id==user_id).order_by(longtermmemory.created_at.desc()).limit(20).all()

        if not memories:
            return "no saved memory found"

        return "\n".join([f"-{m.memory}" for m in memories])
    finally:
        db.close()

def rename_convo(thread_id:str, user_id:int, new_title:str)->bool:
    db=SessionLocal()

    try:
        convo=db.query(conversation).filter(conversation.thread_id==thread_id, conversation.user_id==user_id).first()
        if not convo:
            return False
        convo.title=new_title.strip()[:60] or "Untitled Chat"
        convo.updated_at=datetime.utcnow()
        db.commit()
        return True
    finally:
        db.close()

def delete_convo(thread_id:str, user_id:int)->bool:
    db=SessionLocal()
    try:
        convo=db.query(conversation).filter(conversation.thread_id==thread_id, conversation.user_id==user_id).first()
        if not convo:
            return False
        db.delete(convo)
        db.query(chatmessage).filter(chatmessage.thread_id==thread_id).delete()

        db.commit()
        return True
    finally:
        db.close()







