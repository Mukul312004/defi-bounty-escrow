FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Initialize the SQLite database during the build process
RUN python init_db.py

EXPOSE 5000

CMD ["python", "app.py"]