FROM python:3.10-slim

WORKDIR /code

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy the app directory
COPY ./app /code/app

# Set the command to run the FastAPI app on port 7860 (Hugging Face default)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
