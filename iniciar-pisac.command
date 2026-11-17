#!/bin/bash
cd "$(dirname "$0")"

echo
echo "  ===================================================="
echo "    PISAC - Plataforma de Interaccion y Seguimiento"
echo "  ===================================================="
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  [ERROR] No se encontro Node.js."
  echo "  Instalalo desde:  https://nodejs.org"
  echo
  read -p "  Pulsa Enter para salir..."
  exit 1
fi

NODE_MAYOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAYOR" -lt 20 ]; then
  echo "  [ERROR] Tu version de Node.js es demasiado antigua: $(node -v)"
  echo
  echo "  PISAC necesita Node.js 20 o superior (recomendado 22 LTS)."
  echo "  Descargalo desde https://nodejs.org y vuelve a intentar."
  echo
  read -p "  Pulsa Enter para salir..."
  exit 1
fi

if [ ! -f "package.json" ]; then
  echo "  [ERROR] Falta package.json en esta carpeta."
  echo "  Extrae de nuevo el ZIP completo y abre este archivo desde"
  echo "  la carpeta  pisac."
  echo
  read -p "  Pulsa Enter para salir..."
  exit 1
fi

faltan_dependencias() {
  for m in dotenv express better-sqlite3 jsonwebtoken bcryptjs google-auth-library; do
    [ -f "node_modules/$m/package.json" ] || return 0
  done
  return 1
}

if faltan_dependencias; then
  echo "  Instalando componentes (solo la primera vez)..."
  echo "  Esto puede tardar un par de minutos. Por favor espera."
  echo
  npm install --no-audit --no-fund || {
    echo
    echo "  [ERROR] Fallo la instalacion."
    echo "  Ejecuta ./reparar-pisac.command o revisa tu conexion."
    echo
    read -p "  Pulsa Enter para salir..."
    exit 1
  }
  echo
  if faltan_dependencias; then
    echo "  [ERROR] No se pudieron instalar los componentes."
    echo "  Ejecuta ./reparar-pisac.command"
    echo
    read -p "  Pulsa Enter para salir..."
    exit 1
  fi
fi

# Si ya esta corriendo, solo abre el navegador
if command -v lsof >/dev/null 2>&1 && lsof -i:3000 >/dev/null 2>&1; then
  echo "  La aplicacion ya esta en ejecucion. Abriendo el navegador..."
  if command -v open >/dev/null 2>&1; then open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
  fi
  sleep 2
  exit 0
fi

echo "  Iniciando el servidor..."
echo "  El navegador se abrira automaticamente en unos segundos."
echo
echo "  ------------------------------------------------------"
echo "   Para CERRAR la aplicacion: cierra esta ventana."
echo "  ------------------------------------------------------"
echo

(
  sleep 4
  if command -v open >/dev/null 2>&1; then open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
  fi
) &

node src/server.js

echo
echo "  El servidor se ha detenido."
echo "  Si fue por un error, ejecuta ./reparar-pisac.command"
read -p "  Pulsa Enter para salir..."
