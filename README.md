# Acreditación — After Run · Polar Light

App de control de acceso en puerta. Se abre en el navegador de cualquier teléfono: **sin instalar nada, sin cuenta de Claude, sin usuario**. Los dos equipos de protocolo marcan sobre la misma base y se ven en vivo.

- 299 invitados · aforo máximo 350
- Búsqueda por nombre o cédula (ignora acentos y guiones)
- Agregar invitados a la lista o registrar walk-ins, con control de cupos
- Reporte CSV de asistencia al cierre
- Si se cae internet, cada dispositivo sigue trabajando en modo local

---

## ⚠️ Antes de subir nada

**La lista de invitados no va en el repositorio.** Son 299 nombres con cédula; si el repo es público, quedan indexables. El archivo `lista-after-run.json` vive en tu computadora y se carga **una sola vez** desde la app (Panel → *Cargar lista base del evento* → seleccionas el archivo). De ahí en adelante vive en Firestore, protegida por reglas.

Por eso `.gitignore` excluye `data/`. Si subes los archivos arrastrándolos a la web de GitHub, **no arrastres la carpeta `data`**.

---

## Paso 1 — Firebase (la base compartida)

Sin esto la app funciona, pero cada teléfono queda aislado.

1. **console.firebase.google.com** con tu Google → **Crear un proyecto** → nómbralo `after-run` → puedes desactivar Analytics.
2. **Compilación → Firestore Database** → *Crear base de datos* → modo **producción** → ubicación `nam5` o `us-central`.
3. **Compilación → Authentication** → *Comenzar* → pestaña **Sign-in method** → habilitar **Anónimo**. Sin esto la app no puede escribir.
4. Vuelve a **Firestore → pestaña Reglas** → borra todo, pega el contenido de `firestore.rules` → **Publicar**.
5. **⚙ Configuración del proyecto → Tus apps → icono `</>`** → registra una app web (nombre: `puerta`) → copia el bloque `firebaseConfig`.

## Paso 2 — `config.js`

Abre `config.js` y llena dos cosas:

- `pin` — el PIN que le das a protocolo. **Cámbialo**, no dejes `1234`.
- `firebase` — los valores del `firebaseConfig` del paso anterior.

## Paso 3 — Subir a GitHub

**Opción A — sin terminal (5 minutos)**

1. **github.com/new** → nombre `after-run` → **Public** → *Create repository*.
2. En la pantalla siguiente: **uploading an existing file**.
3. Arrastra `index.html`, `config.js`, `backend.js`, `firestore.rules`, `README.md`. **No arrastres `data/`.**
4. *Commit changes*.

**Opción B — desde la terminal** (el repo ya está inicializado y con el primer commit hecho)

```bash
cd ~/Documents/Claude/Projects/KACREA/after-run-web
git remote add origin https://github.com/<tu-usuario>/after-run.git
git branch -M main
git push -u origin main
```

## Paso 4 — Activar GitHub Pages

Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `/ (root)` → **Save**.

En 1-2 minutos queda en `https://<tu-usuario>.github.io/after-run/`. Ese es el link que le pasas a protocolo por WhatsApp.

> GitHub Pages en cuentas gratuitas exige repo **público**. El código queda visible (no es problema), la lista **no** (no se sube). Si prefieres repo privado: sube el repo como *Private* y publícalo con **Netlify** (netlify.com → *Add new site* → *Import from Git* → conecta el repo). Gratis y el link es público igual.

## Paso 5 — Cargar la lista

Abre el link → PIN → **Panel → Agregar invitados → Cargar lista base del evento** → selecciona `lista-after-run.json` (está en `~/Documents/Claude/Projects/KACREA/`). Se escribe en Firestore una vez y ya la ven todos los dispositivos.

---

## Prueba obligatoria antes del evento

Abre el link en dos teléfonos, marca un ingreso en uno y verifica que aparece en el otro en segundos. Si no aparece: revisa que **Authentication → Anónimo** esté habilitada y que las reglas estén publicadas.

Después de ensayar: **Panel → Borrar solo los ingresos**, para llegar al evento con la lista limpia.

---

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La app completa (interfaz + lógica) |
| `config.js` | **Lo único que editas**: PIN, aforo y claves de Firebase |
| `backend.js` | Puerta de PIN, conexión con Firestore y carga de la lista |
| `firestore.rules` | Reglas de seguridad para pegar en Firebase |
| `lista-after-run.json` | Los 299 invitados. **Fuera del repo**, en tu computadora |

## Sobre la seguridad

El PIN evita que alguien que reciba el link por error vea la lista. No es cifrado: quien sepa leer código en el navegador lo encuentra. La protección real son las reglas de Firestore, que impiden consultar la base desde fuera de la app. Para un evento de una noche, esa combinación es suficiente.

Las claves de Firebase en `config.js` no son secretas por diseño: identifican el proyecto, no dan permisos. Los permisos los dan las reglas.
