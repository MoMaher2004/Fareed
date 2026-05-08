FROM python:3.11-slim

# Create user
RUN useradd -m sandboxuser

# Set working directory
WORKDIR /sandbox

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    curl \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    libglib2.0-0 \
    libsndfile1 \
    libasound2-dev \
    portaudio19-dev \
    python3-dev \
    libgtk-3-0 \
    pkg-config \
    tk \
    chromium \
    chromium-driver \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Install Python libraries
RUN pip install --no-cache-dir \
    bcrypt \
    beautifulsoup4 \
    category_encoders \
    chromadb \
    click \
    dash \
    dash-bootstrap-components \
    dash-core-components \
    dash-html-components \
    dash-table \
    datasets \
    decorator \
    fastapi \
    flask \
    googlesearch-python \
    imbalanced-learn \
    kagglehub \
    keras \
    kubernetes \
    langchain \
    langchain-chroma \
    langchain-core \
    langchain-nvidia-ai-endpoints \
    langgraph \
    langgraph-checkpoint \
    langgraph-prebuilt \
    langgraph-sdk \
    langsmith \
    matplotlib \
    nltk \
    numpy \
    ollama \
    openai \
    opencv-python \
    pandas \
    pillow \
    plotly \
    prettytable \
    prompt_toolkit \
    pydantic \
    pygame \
    pyOpenSSL \
    python-dotenv \
    rank-bm25 \
    requests \
    scapy \
    scikit-learn \
    scipy \
    seaborn \
    selenium \
    selenium-wire \
    sentence-transformers \
    sounddevice \
    soundfile \
    SpeechRecognition \
    SQLAlchemy \
    sqlparse \
    tabulate \
    tensorflow \
    tf_keras \
    threadpoolctl \
    tqdm \
    transformers \
    undetected-chromedriver \
    xgboost

# Copy worker script
COPY worker.py .

# Permissions
RUN chmod +x worker.py

# Switch to non-root user
USER sandboxuser

# Run script
CMD ["python3", "-u", "worker.py"]
