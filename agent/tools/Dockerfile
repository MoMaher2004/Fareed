FROM python:3.11-slim

RUN useradd -m sandboxuser

WORKDIR /sandbox

COPY worker.py .

RUN chmod +x worker.py

USER sandboxuser

CMD ["python3", "-u", "worker.py"]