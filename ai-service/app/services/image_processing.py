import io
import numpy as np
from PIL import Image
import PIL.ImageOps

def prepare_image(image_bytes: bytes, img_size: int) -> np.ndarray:
    """
    Convert an uploaded image into the format expected by our trained CNN.
    QuickDraw training data: white strokes on black background, 28x28 grayscale, 0-1 float.
    """
    img = Image.open(io.BytesIO(image_bytes))

    # Flatten transparent/semi-transparent backgrounds to white
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        alpha = img.convert("RGBA").split()[-1]
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        bg.paste(img, mask=alpha)
        img = bg

    # Grayscale
    img = img.convert("L")

    # Invert: we need white strokes on black (QuickDraw standard)
    img = PIL.ImageOps.invert(img)

    # Crop tightly around the drawing so it fills the frame
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    # Resize to exactly img_size x img_size
    img = img.resize((img_size, img_size), Image.Resampling.LANCZOS)
    
    # Normalize
    arr = np.array(img, dtype="float32") / 255.0
    return arr.reshape(1, img_size, img_size, 1)
