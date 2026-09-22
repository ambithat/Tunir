import uuid
from abc import ABC,abstractclassmethod
from typing import Any,List,Optional,TypeVar,Generic

T = TypeVar("T")

class AbstractRepository(ABC,Generic[T]):
    
    @abstractclassmethod
    async def create(cls,obj_in:T) -> Any:
        pass

    @abstractclassmethod
    async def get_by_id(cls,**kwargs) -> Optional[Any]:
        pass

    @abstractclassmethod
    async def delete_all(cls,**kwargs) -> Optional[Any]:
        pass
    
        