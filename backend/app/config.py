"""Configuration loaded from environment variables (with .env support)."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM provider keys
    GROQ_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""  # for Gemini Vision (OCR fallback)

    # Models
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    LLM_MODEL: str = "llama-3.1-70b-versatile"  # Groq

    # Chunking
    CHUNK_SIZE: int = 600    # characters
    CHUNK_OVERLAP: int = 100

    # Retrieval
    TOP_K_DENSE: int = 10
    TOP_K_BM25: int = 10
    TOP_K_FINAL: int = 5     # after fusion

    # Storage
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # Misc
    MAX_PDF_MB: int = 25
    CORS_ORIGINS: str = "http://localhost:3000,https://docintel.vercel.app"


settings = Settings()
