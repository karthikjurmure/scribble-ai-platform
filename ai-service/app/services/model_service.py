import os
import tensorflow as tf
import numpy as np

class ModelService:
    def __init__(self):
        self.labels = self._load_labels()
        self.model = self._load_model()
        self.img_size = self.model.input_shape[1]

    def _load_labels(self):
        classes_path = os.path.join(os.path.dirname(__file__), "..", "model", "classes.txt")
        try:
            with open(classes_path, "r", encoding="utf-8") as f:
                return [line.strip() for line in f if line.strip()]
        except FileNotFoundError:
            print(f"Warning: Could not find {classes_path}")
            return []

    def _load_model(self):
        model_path = os.path.join(os.path.dirname(__file__), "..", "model", "model.h5")
        print(f"Loading model from {model_path} ...")
        return tf.keras.models.load_model(model_path)

    def predict(self, img_array: np.ndarray):
        prediction = self.model.predict(img_array, verbose=0)
        top_indices = np.argsort(prediction[0])[-3:][::-1]
        
        results = [
            {
                "label": self.labels[i] if i < len(self.labels) else f"class_{i}",
                "confidence": float(prediction[0][i])
            }
            for i in top_indices
        ]
        return results

# Singleton instance
ai_model = ModelService()
