
# import time
# import queue
# import paddleocr
# from pathlib import Path
# from ultralytics import YOLO
# from app.core.config import SEGMENTMODEL,OBJMODEL,logger
# import threading
# import asyncio
# import signal

# from ..services import CameraSetup
# from ..services import OheClass

# from ..services import TrainMaster
# from ..services import CameraAPI
# from ..services import N_CameraAPI
# from ..services import DetectionClass
# from ..services import SegmentationClass
# from  ..services import TrainStatus
# from ..services import CollisionAClass
# from ..db.base import DatabaseSchema
# from ..services import DriverDrowsinessNew
# from ..services import TrainStatus
# from ..services import Service

# class Master:

#     """
#        Master class 
#     """

#     t_setup_obj = None
#     t_api_obj = None
#     t_collision_obj = None
#     t_detect_obj = None
#     t_segment_obj = None
#     t_main_obj = None
#     t_ohe_obj = None
#     yolo_model = None
#     object_model = None
#     segmentation_model  = None
#     ocr_model = None
#     thread_condition = None
#     thread_condition2 = None
#     master_object = None
#     ocr_task_queue = None
#     ocr_results_queue = None
#     audio_task_queue = None
#     initial_speed = 40  # Speed in km/h
#     blurred_mask  = None
#     segment_value = 0
# # total_time = int(input("Enter the total time for the train to stop (in seconds): "))
#     total_time = 35     # Full video 27 sec and 35 speed and 33 ms wait time  # Trim video 20 sec and 35 speed and 33 ms wait time
#     speed_list=[]
#     brake_list = []
   
#    # asyncio event varialbles here 
#     ohe_value_event = None
#     detected_class_event = None
#     distance_value_evnet = None
#     signal_value_event = None
#     drowsiness_value_event = None
#     video1_value_event = None
#     video2_value_event = None
#     segment_frame_event = None


#     ohe_value_event1 = None
#     detected_class_event1 = None
#     distance_value_evnet1 = None
#     signal_value_event1 = None
#     drowsiness_value_event1 = None    
#     video_value_event1 = None
#     video_value_event2 = None
#     segmentation_frame_event1 = None

#     @classmethod
#     def _load_model(cls) -> None:
#         """
#            Load all the models  (Object detection,Segmentation,PaddleOCR)  
#         """
#         try:
#             Master.yolo_model = YOLO(Path("App/Assets/Models/yolov8n.pt"),task="detect")
#             Master.obj_model = YOLO(Path(OBJMODEL),task="detect")
#             Master.seg_model = YOLO(Path(SEGMENTMODEL),task="segment")
#             Master.ocr_model = paddleocr.PaddleOCR(use_angle_cls=True, lang='en',use_tensorrt=False)

#         except Exception as e :
#             print(f"An exception error occurred from _load_model method in the model module :",e)  
#             logger.error(f"An exception error occurred from _load_model method in the model module : {e}")      

#     @classmethod
#     def object_initializer_function(cls) -> None:

#         '''

#         Object Creation for all the Classes in the Application 
#         t_setup_obj = CamerSetup Class 
#         t_main_obj = TrainMaster Class
#         t_detect_obj = Detection Class
#         t_ohe_obj = Ohe Class
#         t_collision_obj = Collision Class
#         t_segment_obj = Segmentation Class
#         t_api_obj = Camera API integration Class

#         '''
#         Master._load_model()
#         Master.t_setup_obj = CameraSetup()
        
#         Master.t_detect_obj = DetectionClass()
#         Master.t_ohe_obj = OheClass()
#         Master.t_collision_obj = CollisionAClass()
#         Master.t_segment_obj = SegmentationClass()
#         # Master.t_api_obj = CameraAPI()
#         Master.t_api_obj = N_CameraAPI()
#         Master.t_service_obj = Service()
#         try:
#             signal.signal(signal.SIGBUS, Master.t_service_obj.reciveSignal)
#             signal.signal(signal.SIGSEGV, Master.t_service_obj.reciveSignal)
#             signal.signal(signal.SIGABRT, Master.t_service_obj.reciveSignal)
#         except Exception as e:
#             print(f"Warning: Cannot catch some signals on this system: {e}")

#         Master.t_main_obj = TrainMaster()
#         Master.t_db_obj = DatabaseSchema()
        
#         Master.t_status_obj =TrainStatus()

#         ### asyncio event variables initialization 
#         Master.detected_class_event = asyncio.Event()
#         Master.ohe_value_event = asyncio.Event()
#         Master.distance_value_evnet = asyncio.Event()
#         Master.signal_value_event = asyncio.Event()
#         Master.drowsiness_value_event = asyncio.Event()
#         Master.video1_value_event = asyncio.Event()
#         Master.video2_value_event = asyncio.Event()
#         Master.segment_frame_event = threading.Event()

#         Master.t_dd_obj = DriverDrowsinessNew(cls = Master)
        
#         Master.audio_task_queue = queue.Queue()

#     @classmethod
#     def thread_condition_init(cls,condition1) -> None:
#         """
#             thread_condition_init method
#         """
#         try:
#             Master.thread_condition = condition1
#             Master.thread_condition2 = condition1
#         except Exception as e :
#             print(f"An exception error occurred from thread_condition_init method in the model module :",e)            
#             logger.error(f"An exception error occurred from thread_condition_init method in the model module :{e}")


#     @classmethod
#     def master_video_object(cls,obj) -> None:
#         """
#             master_vidoe_object
#         """
#         try:
#             Master.master_object = {"Master":obj}
#             Master.ocr_task_queue = queue.Queue()
#             Master.ocr_results_queue = queue.Queue()
#             Master.audio_task_queue = queue.Queue()
#         except Exception as e :
#             print(f"An exception error occurred from master_vidoe_object method in the model module :",e)

#     @classmethod
#     def brake(cls,speed):
#         # Constants
#         g = 9.81  # gravitational acceleration in m/s^2
        
#         # Parameters (adjust according to the Indian Railways 2020 standards)
#         initial_speed_kmph = speed  # Initial speed in km/h
#         initial_speed = initial_speed_kmph * (1000 / 3600)  # Convert km/h to m/s
#         braking_ratio = 1.10  # Braking ratio (110%)
#         empty_weight = 3000  # Empty weight of the train in tons
#         gross_weight = 3500  # Gross weight of the train in tons
#         grade = 0.001  # Grade of the track (in decimal form)
#         fws = 0.093  # Wheel/shoe adhesion for a speed of ~100 km/h
#         air_propagation_time = 5  # Time for air to propagate to the rear in seconds
#         brake_development_time = 16  # Time for full brake development in seconds at 90 psi
        
#         # Calculating braking efficiency (Beff)
#         braking_efficiency = (braking_ratio) * (empty_weight / gross_weight)
        
#         # Rigging efficiency (Reff), assuming average efficiency of 0.85
#         rigging_efficiency = 0.85
        
#         # Maximum deceleration rate (-amax)
#         amax = ((fws + grade + 0.0015) * braking_efficiency * rigging_efficiency * g)
        
#         # Time to reach full braking (consider air propagation + brake development time)
#         time_to_full_braking = air_propagation_time + brake_development_time
        
#         # Deceleration (when full braking is achieved)
#         def deceleration(v0, a):
#             return v0 / a
        
#         # Distance covered during deceleration (s = v0 * t + 0.5 * a * t^2)
#         def braking_distance(v0, a, t):
#             return v0 * t + 0.5 * a * t**2
        
#         # Calculate total stopping time and distance
#         stopping_time = deceleration(initial_speed, amax)
#         stopping_distance = braking_distance(initial_speed, amax, stopping_time)
#         print(f"Initial speed: {speed} km/h")
#         print(f"Total time to stop: {stopping_time + time_to_full_braking:.2f} seconds")
#         print(f"Total distance to stop: {stopping_distance:.2f} meters")
#         return stopping_distance
#         # return stopping_time, stopping_distance, time_to_full_braking  
         
            
#     @classmethod
#     def emergency_brake(cls):
#         current_speed = Master.initial_speed
#         decrement_per_second = Master.initial_speed / Master.total_time
        
#         print("Emergency brake applied!")
#         for second in range(1, Master.total_time + 2):
#             b_dis = cls.brake(float(format(current_speed,".2f")))
#             current_speed -= decrement_per_second
#             if current_speed < 0:
#                 current_speed = 0
#             print(f"\nTime: {second}s, Speed: {current_speed:.2f} km/h\n")
#             Master.speed_list.append(current_speed)  # Update the shared list
#             Master.brake_list.append(b_dis)
#             time.sleep(1)  # Simulating real-time delay of 1 second per step
        
#         print("The train has come to a complete stop.")


#     @classmethod
#     def thred_emergency_brake(cls) -> None:
#         """
#             thread_condition_init method
#         """
#         try:
#             t1 = threading.Thread(target=cls.emergency_brake)
#             t1.daemon=True
#             t1.start()

            
#         except Exception as e :
#             print(f"An exception error occurred from thread_condition_init method in the model module :",e)    


#     @classmethod
#     def thread_driver_drowsy(cls) -> None:
#         '''
#             thread function for the 
#         '''
        
# '''

# Simin_best.pt - all videos (Segmentation)
 
# test.mp4 - object_detection(signal_detect_best.pt), seg(simin_best.pt), ohe_detection(best.pt)
 
# check_rail.mp4 - object_detection(rail.pt), seg(simin_best.pt), ohe_detection(best.pt)
 
# animal_trim.mp4 - object_detection(rail_nav.pt), seg(simin_best.pt), ohe_detection(best.pt)
 
# Elephant.mp4 - object_detection(rail_nav.pt), seg(simin_best.pt), ohe_detection(best.pt)
 
# Tardid_june_railway.mp4 - object_detection(rail_nav.pt), seg(simin_best.pt), ohe_detection(best.pt)
 
# FinalBikeVideo.mp4 - object_detection(rail.pt), seg(simin_best.pt), ohe_detection(best.pt)
 
# Test_West_Bengal.mp4 - object_detection(wb_best.pt), seg(simin_best.pt), ohe_detection(wb_best.pt)
 
# resizevideo.mp4 - object_detection(wb_best.pt), seg(simin_best.pt), ohe_detection(wb_best.pt)
        
#         '''  
