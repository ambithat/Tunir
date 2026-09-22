from functools import lru_cache
from pydantic import PrivateAttr
# from langchain.llms.base import LLM
from langchain_core.language_models.llms import LLM
from langchain_groq import ChatGroq
from app.config import settings as global_setting
from typing import AsyncIterator




class GroqLLM(LLM):
    temperature: float = 0.0
    
    # 1. PrivateAttr handles the inner model instance within Pydantic's LLM base
    _client: ChatGroq = PrivateAttr()

    def __init__(self, api_key: str, **kwargs):
        # Initialize the parent Pydantic model
        super().__init__(**kwargs) 
        print(f" GroqLLM initialized with model: {global_setting.LLAMA_MODEL_NAME}")
        
        #  THE FIX: Do NOT pass http_client here.
        # ChatGroq uses its own internal sync client for initialization.
        # It handles async transitions automatically when ainvoke is called.
        self._client = ChatGroq(
            model_name=global_setting.LLAMA_MODEL_NAME,
            temperature=self.temperature,
            api_key=api_key
        )

    def _call(self, prompt: str, stop=None, **kwargs):
        """Synchronous call wrapper."""
        resp = self._client.invoke(prompt)
        return resp.content if hasattr(resp, "content") else str(resp)
    
    async def _acall(self, prompt: str, stop=None, **kwargs):
        """Async version of _call using LangChain's internal async handling."""
        resp = await self._client.ainvoke(prompt)
        return resp.content if hasattr(resp, "content") else str(resp)
        
    @property
    def _llm_type(self) -> str:
        return "groq"

    def invoke(self, prompt: str, **kwargs):
        """Overriding base invoke to ensure content extraction."""
        return self._call(prompt)
    
    async def ainvoke(self, prompt: str, **kwargs):
        """Overriding base ainvoke to ensure content extraction."""
        return await self._acall(prompt)

    async def astream_text(self, prompt: str, **kwargs) -> AsyncIterator[str]:
        """Yield text chunks directly from the provider while the model is generating."""
        async for chunk in self._client.astream(prompt):
            text = getattr(chunk, "content", "")
            if text:
                yield text

    async def aclose(self):
        """
         SAFE CLEANUP: 
        Since we no longer manage the client manually, we just confirm 
        the resource release.
        """
        print(" GroqLLM resources released.")
    
    @classmethod
    @lru_cache(maxsize=1)
    def get_instance(cls, api_key: str):
        """Singleton pattern via LRU cache to prevent multiple instantiations."""
        return cls(api_key=api_key)

# class GroqLLM(LLM):
#     temperature: float = 0.0
    

#     def __init__(self,api_key:str):
#         super().__init__()
#         print("GroqLLM is created ..")
#         self._client = ChatGroq(
#             model_name=global_setting.LLAMA_MODEL_NAME,
#             temperature=self.temperature,
#             groq_api_key=api_key
#         )
  

#     def _call(self, prompt: str, stop=None):
#         resp = self._client.invoke(prompt)
#         return resp.content if hasattr(resp, "content") else str(resp)
    
#     async def _acall(self, prompt: str, stop=None):
#         """Async version of _call"""
#         resp = await self._client.ainvoke(prompt)
#         return resp.content if hasattr(resp, "content") else str(resp)
        
#     @property
#     def _llm_type(self):
#         return "groq"

#     def invoke(self, prompt: str):
#         return self._call(prompt)
    
#     async def ainvoke(self, prompt: str):
#         """Async invoke method"""
#         return await self._acall(prompt)
    
#     @classmethod
#     @lru_cache
#     def get_instance(cls):
        
#         return GroqLLM() 