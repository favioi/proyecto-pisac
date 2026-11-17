#!/bin/bash
cd "$(dirname "$0")"

echo
echo "  ===================================================="
echo "    PISAC - Reparar instalacion"
echo "  ===================================================="
echo
echo "  Esto borra node_modules y vuelve a instalar los componentes."
echo "  NO borra tus datos: la base de datos esta en la carpeta data."
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  [ERROR] No se encontro Node.js. Instalalo desde https://nodejs.org"
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
  echo "  [ERROR] Falta package.json. Extrae de nuevo el ZIP completo."
  read -p "  Pulsa Enter para salir..."
  exit 1
fi

echo "  Borrando componentes anteriores..."
rm -rf node_modules package-lock.json

echo "  Reinstalando (puede tardar un par de minutos)..."
echo
if ! npm install --no-audit --no-fund; then
  echo
  echo "  [ERROR] Fallo la instalacion. Revisa tu conexion a internet."
  read -p "  Pulsa Enter para salir..."
  exit 1
fi

echo
echo "  Comprobando que todo este listo..."
echo
npm run verificar

echo
echo "  ------------------------------------------------------"
echo "   Reparacion terminada. Cierra esta ventana y abre"
echo "   iniciar-pisac.command"
echo "  ------------------------------------------------------"
read -p "  Pulsa Enter para salir..."
