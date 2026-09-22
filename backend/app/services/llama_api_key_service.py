
import re
from datetime import datetime , timedelta,timezone
from zoneinfo import ZoneInfo
from app.schemas.application_tables.api_key_schema import ApiKeyDTO
from app.repositories.application_tables.llm_api_key_repository import ApiKeyRepository
from app.models.application_tables.api_key import ApiKey, KeyStatus


class ApiKeyService:
    def __init__(self,repo:ApiKeyRepository):
        self.repo = repo


    async def create_api_key(self,
                             api_key:str,
                             priority:int
                             ):
        try:
            print("inside ..")
            obj = ApiKey(
                api_key=api_key,
                priority=priority
            )
            print(self.repo,"RRRRRRRRRRRRRRR")
            result = await self.repo.create_api_key(obj=obj)
            print(2)
            if not result :
                return {"Error":"Error occured while inserting the api key .. please try again .... "}
            return {"message":"Api key added.."}
        except Exception as e:
            print(e)
            raise Exception(f"{repr(e)}")
        
    async def update_api_key_status(self,
                                    api_key:str,
                                    param:dict
                                    ):
        try:
            # If this is a success log (has last_used_at), reset fail_count and restore priority
            if "last_used_at" in param:
                key_obj = await self.repo.get_by_api_key(api_key)
                if key_obj:
                    fail_count = key_obj.fail_count or 0
                    if fail_count > 0:
                        param["priority"] = max(1, (key_obj.priority or 1) - 2 * fail_count)
                    param["fail_count"] = 0

            result = await self.repo.update_status(api_key=api_key,
                                                   param=param)
            if not result :
                return None
            print(f"EERRRRRRRRRRRRRRR {result}")
            print(f"ACTIVE API KEY {result}")
            time_stamp = datetime.now(ZoneInfo("Asia/Kolkata"))
            status_param = {"status": KeyStatus.ACTIVE}
            update_status = await self.repo.update_status_on_unlock(time_stamp=time_stamp,
                                                                    param=status_param)
            if update_status:
                print(f"Status unclocked ... ")
            return result
        except Exception as e:
            print(e)
            raise Exception(f'{repr(e)}')
    
    async def get_active_api_key(self):
        try:
            api_key_obj = await self.repo.get_active_api_key()
            if not api_key_obj:
                return None
            return api_key_obj.api_key
        except AttributeError as ae:
            print(f"Attribute errro while fecthing the api key {ae}")
            raise AttributeError(f"{repr(ae)}")
        except Exception as e:
            raise Exception(f"{repr(e)}")
        

    def get_next_token_available_time(self,error_detail:str):
        try:
            print(f"ERROR DETAIL {error_detail}")
            wait_time = timedelta(seconds=30) # default fallback
            
            # Find the time string after "try again in"
            match = re.search(r"try again in ([^\s\)]+)", error_detail, re.IGNORECASE)
            if match:
                time_str = match.group(1)
                hours_match = re.search(r"(\d+)h", time_str)
                mins_match = re.search(r"(\d+)m", time_str)
                secs_match = re.search(r"(\d+(?:\.\d+)?)s", time_str)
                
                hours = int(hours_match.group(1)) if hours_match else 0
                mins = int(mins_match.group(1)) if mins_match else 0
                secs = float(secs_match.group(1)) if secs_match else 0
                
                if hours or mins or secs:
                    wait_time = timedelta(hours=hours, minutes=mins, seconds=secs)
            else:
                match_direct = re.search(r"(\d+)m(\d+(?:\.\d+)?)s", error_detail)
                if match_direct:
                    wait_time = timedelta(minutes=int(match_direct.group(1)), seconds=float(match_direct.group(2)))
                else:
                    match_secs = re.search(r"(\d+(?:\.\d+)?)s", error_detail)
                    if match_secs:
                        wait_time = timedelta(seconds=float(match_secs.group(1)))
            
            print(f"Calculated wait time: {wait_time}")
            return datetime.now(ZoneInfo("Asia/Kolkata")) + wait_time
        
        except Exception as e:
            raise Exception(f"{repr(e)}")
        

    async def get_retry_api_key_logic(self,
                                      api_key:str,
                                      error_detail:str):
        try:
            next_available_time = self.get_next_token_available_time(error_detail=error_detail)    
            param = {
                "next_available_at":next_available_time,
                "status": KeyStatus.RATE_LIMITED,
                "rate_limited_at": datetime.now(ZoneInfo("Asia/Kolkata")),
                "fail_count": ApiKey.fail_count + 1,
                "priority": ApiKey.priority + 2
            }
            result = await self.repo.update_status(api_key=api_key,
                                                      param=param)
            if result:
                
                api_key,rate_limited_keys = await  self.repo.get_retry_api_key()
                print(f"API KEY {api_key} \n RATE LIMITED KEYS {rate_limited_keys}")
                if not api_key:


                    if not rate_limited_keys:
                        return None,"No API Keys available. "
                
                    now = datetime.now(ZoneInfo("Asia/Kolkata"))
                    wait_times = []

                    for key in rate_limited_keys:
                        if key.next_available_at:
                            remaining = (key.next_available_at - now).total_seconds() / 60
                            if remaining > 0:
                                wait_times.append(remaining)
                    if not wait_times:
                        return None, "All API keys are rate limited. Try again soon."
                    min_wait = min(wait_times)
                    return None, f"All API keys are rate-limited. Try again in {min_wait:.2f} minutes."
                return api_key.api_key,None
        except Exception as e:
            raise Exception(f"{repr(e)}")
    
    async def get_all_api_key(self):
        try:
            api_key_results = await self.repo.get_all()
            if not api_key_results :
                return None
            print(api_key_results,"FFFFFFFFFFFFFFFF")

            api_key_result = [
                ApiKeyDTO.model_validate(result) for result in api_key_results
            ]
            print(f"Before passing the result {api_key_result}")
            return api_key_result
        
        except Exception as e:
            raise Exception(f"{repr(e)}")
            
        
    async def delete_by_api_key(self,
                                api_key:str):
        try:
            result = await self.repo.delete_by_api_key(api_key=api_key)
            if not result :
                return None
            return {"Message":f"Api key {api_key} is deleted .. "}
        except Exception as e:
            raise Exception(f"{repr(e)}")

    async def delete_api_keys(self):
                                
        try:
            result = await self.repo.delete_api_key()
            if not result :
                return None
            return {"Message":f"Api key table is deleted .. "}
        except Exception as e:
            raise Exception(f"{repr(e)}")
