#!/bin/bash

sourec ../.env

REPO_URL="https://lmvela:$GH_TOKEN@github.com/lmvela/conta_check_status.git"
BASE_DIR="./app"                # Puedes cambiarlo si quieres

echo "--------------------------------------------"
echo "  Actualización de contenedor Flask + Docker"
echo "--------------------------------------------"
echo ""

# Asegurar directorio base
if [ ! -d "$BASE_DIR" ]; then
    echo "📁 Creando directorio base: $BASE_DIR"
    mkdir -p "$BASE_DIR"
fi

# 1️⃣ Si el repositorio NO existe → git clone
if [ ! -d "$BASE_DIR" ]; then
    echo "📥 Repositorio no encontrado. Clonando..."
    git clone "$REPO_URL" "$BASE_DIR"

    if [ $? -ne 0 ]; then
        echo "❌ ERROR: No se pudo clonar el repositorio."
        exit 1
    fi

    echo "✔ Repositorio clonado correctamente."
else
    # 2️⃣ Si existe → git pull
    echo "🔄 Repositorio encontrado. Actualizando..."
    cd "$BASE_DIR"

    git pull "$REPO_URL" master

    if [ $? -ne 0 ]; then
        echo "❌ ERROR: No se pudo hacer git pull."
        exit 1
    fi

    echo "✔ Código actualizado correctamente."
fi

# 3️⃣ Levantar y reconstruir el contenedor
echo ""
echo "🐳 Reconstruyendo contenedor con Docker Compose..."
cd "$REPO_DIR"

docker compose down
docker compose build --no-cache
docker compose up -d

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Docker Compose falló."
    exit 1
fi

echo ""
echo "✅ Contenedor actualizado y corriendo."
echo "--------------------------------------------"

cd ..

