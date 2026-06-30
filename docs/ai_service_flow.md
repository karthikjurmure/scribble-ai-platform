# AI Inference Service Flow 🤖

The AI service is a Python-based microservice built with **FastAPI** and **TensorFlow**. It provides real-time image recognition for drawings using a CNN trained on the Google QuickDraw dataset.

## 📁 File Structure & Responsibilities

### API Layer
- **`app/main.py`**: Defies the RESTful interface.
    - **`POST /predict`**: Accepts a binary image file, triggers the preprocessing pipeline, and returns JSON predictions.
    - **`GET /health`**: Returns the status of the service, including the number of recognized categories and model image dimensions.
    - **CORS/Uvicorn**: Configures the server to be accessible by the Node.js backend.

### Service Layer (`app/services/`)
- **`model_service.py`**: Manages the neural network.
    - **Lazy Loading**: Loads the `.h5` model file and labels into memory upon the first request or service start.
    - **Inference**: Converts preprocessed arrays into class probabilities.
- **`image_processing.py`**: The critical "Translation" layer.
    - **Normalization**: Resizes the incoming canvas image (which can be any size) to exactly **28x28 pixels** or **64x64 pixels** as required by the model.
    - **Binarization**: Converts colors to grayscale and inverts them (White ink on Black background) to match the training data format.

### Model Assets (`app/model/`)
- **`model.h5`**: The binary weights of the trained CNN.
- **`classes.txt`**: A mapping file that translates the model's output index (0-26) into human-readable words (e.g., "Apple", "Bicycle").

---

## 🔄 The Connection Flow

1.  **Request Origin**: The Node.js **Game Engine** sends an HTTP request containing a canvas snapshot.
2.  **API Entry**: `main.py` receives the bytes and hands them to `image_processing.py`.
3.  **Transformation**: `image_processing.py` uses `Pillow` and `NumPy` to transform the image into a 4D tensor (Batch Size, Height, Width, Channels).
4.  **Inference**: `model_service.py` runs `model.predict()` on the tensor.
5.  **Response**: `main.py` formats the top 3 results into a JSON object and returns it to the backend.

## 🧠 Model Technical Details
- **Architecture**: 3-block CNN with Global Average Pooling.
- **Optimization**: Uses `tf_keras` for legacy compatibility with specific deployment environments.
- **Throughput**: Optimized to handle inference in <100ms, enabling real-time feedback for the AI Bot.
