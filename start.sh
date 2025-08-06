#!/bin/bash

echo "🚀 Starting VoiceChat-Ollama Application..."

# Check if Ollama is running
echo "📡 Checking Ollama status..."
if ! curl -s http://localhost:11434/api/version > /dev/null; then
    echo "❌ Ollama is not running. Please start Ollama first:"
    echo "   ollama serve"
    exit 1
fi

echo "✅ Ollama is running"

# Check if llama3 model is available
echo "🤖 Checking if llama3 model is available..."
if ! ollama list | grep -q "llama3"; then
    echo "⬇️  llama3 model not found. Downloading..."
    ollama pull llama3
fi

echo "✅ llama3 model is ready"

# Start the application
echo "🐳 Starting Docker containers..."
docker-compose up --build

echo "🎉 Application is ready!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"