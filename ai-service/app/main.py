from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
app=FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def home():
    return {"status":"this is ai service"}
@app.post("/predict")
async def predict(file:UploadFile=File(...)):
    return {
        "guesses": [
            {"label": "Apple", "confidence": 0.95},
            {"label": "Circle", "confidence": 0.04},
            {"label": "Moon", "confidence": 0.01}
        ]
    }
if __name__=="__main__":
    uvicorn.run(app,host="0.0.0.0",port=8000)
