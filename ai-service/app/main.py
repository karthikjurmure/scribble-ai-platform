import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["TF_USE_LEGACY_KERAS"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

from fastapi import FastAPI, UploadFile, File
import uvicorn

from app.services.image_processing import prepare_image
from app.services.model_service import ai_model

app = FastAPI(title="Scribble AI Inference Service")

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    content = await file.read()
    
    
    img_array = prepare_image(content, ai_model.img_size)
    
    
    guesses = ai_model.predict(img_array)
    
    return {"guesses": guesses}

@app.get("/health")
def health():
    return {
        "status": "ok", 
        "classes": len(ai_model.labels), 
        "img_size": int(ai_model.img_size)
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
