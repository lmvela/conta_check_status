# Imagen base con Node.js
FROM node:20

WORKDIR /app

# Instalar dependencias del sistema necesarias
# Incluye git, rsync, bash y certificados para HTTPS
RUN apt-get update && \
    apt-get install -y git rsync bash ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copiar package.json y package-lock.json
COPY app/package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY app/. .

CMD ["npm", "start", "--", "--port", "9000"]
