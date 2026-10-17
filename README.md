# RCCA / Yield NVD — Ingrasys

Documentación del proyecto: propósito, funcionamiento, datos de entrada, almacenamiento, componentes y operación local.

> **Mantenimiento:** cada modificación del proyecto debe incluir la actualización correspondiente de este README en el mismo cambio. Así, la documentación de comportamiento, interfaz, datos, configuración y operación se mantiene alineada con el código.

## 1. Propósito

Este proyecto reúne en una aplicación web local los reportes de fallas, el seguimiento RCCA y las acciones correctivas asociadas a seriales y Work Orders (WO). Ayuda al equipo de Calidad a identificar fallas repetidas, revisar tendencias y áreas responsables, completar los rubros del formato FQ-3264-INT-NVD y verificar que las acciones se cierren con evidencia.

La interfaz tiene tres vistas principales:

- **Dashboard:** indicadores filtrables, cuatro gráficas, cola de acciones y detalle de fallas.
- **RCCA / seriales:** captura de registros locales y consulta del historial agrupado por serial.
- **Fuente Excel:** importación de archivos y explicación de los cálculos.

> **Límite del indicador Yield:** el tablero muestra conteos de eventos y seriales. La tasa por WO se calcula solo cuando se captura el total de unidades procesadas para esa WO y el denominador es válido. No se infiere un Yield general si faltan datos de producción.

## 2. Flujo de uso

1. Selecciona uno o varios archivos `.xlsx`, `.xls` o `.csv` desde **Importar Excel** o **Fuente Excel**.
2. La aplicación busca encabezados compatibles, normaliza los nombres de columnas y conserva solo las filas que tienen serial válido.
3. Cada evento recibe un tipo de falla y un área sugerida con reglas locales. Los casos ambiguos quedan como **POR REVISAR**.
4. Usa filtros, gráficas y el historial por serial para identificar patrones y revisar los rubros RCCA.
5. Completa causa, análisis RC, contención, acción correctiva/preventiva, responsable y evidencia según corresponda.
6. Registra unidades procesadas por WO y sigue las fechas y la efectividad de las acciones.
7. Exporta a Excel los registros que coinciden con los filtros activos.

Los archivos fuente se leen en el navegador y no se reescriben. La aplicación conserva eventos repetidos como filas independientes; las métricas de eventos y seriales únicos se calculan por separado.

## 3. Importación y formato de entrada

La importación acepta varios archivos en una misma selección. En un libro de Excel se prefiere la hoja **`RC ANALYSIS`**; si no existe, se busca una hoja que tenga encabezados reconocibles.

Para detectar la fila de encabezados se requiere:

- Una columna de serial, como `SN`, `SERIAL_NUMBER`, `SERIAL`, `SERIALNUMBER` o `SERIALNO`.
- Al menos una columna relacionada con la falla, por ejemplo `ERROR DESC`, `ROOT CAUSE`, `DEFECT`, `FAIL INFORMATION` o `REASON_DESC2`.
- Una columna de contexto: `WO` / `WORK ORDER`, `OWNER`, estación de prueba, estación o estación de reparación.

Los encabezados se comparan ignorando mayúsculas, acentos, espacios, guiones y saltos de línea. También hay alias en español e inglés para fecha, familia, modelo, estación, serial, responsable, status y campos RCCA. Las columnas ausentes quedan vacías; no se inventan valores.

Si el lector de Excel no carga, la página muestra un error. La biblioteca `xlsx` se entrega desde jsDelivr en el HTML, por lo que el navegador necesita acceso a `cdn.jsdelivr.net` para importar o exportar libros.

## 4. Clasificación de fallas

La clasificación visible del dashboard usa reglas deterministas locales:

1. Evalúa primero `REMARK`.
2. Si no encuentra una regla en `REMARK`, evalúa la descripción combinada de la falla y campos relacionados.
3. Si encuentra una sola categoría, asigna esa área.
4. Si hay evidencia insuficiente o categorías en conflicto, asigna **POR REVISAR**.
5. Si la evidencia incluye un criterio de prueba, la regla de **PRUEBAS** tiene prioridad.

Las áreas manejadas por las reglas locales son:

| Área | Uso general |
| --- | --- |
| `FA` | Falla funcional o sustitución relacionada con una falla funcional. |
| `REWORK` | Reparación o retrabajo incorrecto. |
| `MFG` | Daño físico, ensamble, colocación o manejo. |
| `PRODUCTO` | Defecto o problema de producto/diseño. |
| `PRUEBAS` | Ciclo, retest, actualización o falla de prueba. |
| `PROCESOS` | Parámetro o método de proceso, como temperatura o soldadura. |
| `POR REVISAR` | Evidencia insuficiente o contradictoria. |

La clasificación se puede corregir manualmente en el campo **OWNER** del detalle RCCA. La interfaz conserva tanto la asignación como la explicación para facilitar la revisión.

### Umbral para requerir RCCA

Un serial se marca como **RCCA requerido** cuando acumula **tres o más tipos de falla distintos** dentro de los registros considerados. Varias filas del mismo tipo cuentan como varios eventos, pero como un solo tipo distinto.

## 5. Indicadores, filtros y gráficas

Los indicadores del dashboard se recalculan con los filtros activos:

- **Registros de falla:** filas con serial válido.
- **Seriales únicos:** seriales distintos dentro del resultado filtrado.
- **Seguimiento abierto:** registros con status `ABIERTO`, `LLENADO`, `RECHAZADO`, `EN PROCESO` o `FAIL`.
- **Seguimiento cerrado:** registros con status `CERRADO` o `PASS`, o con `STATUS POST-RWK` igual a `PASS`.
- **WO:** cantidad de Work Orders distintas en los registros filtrados.

Los filtros disponibles son status, área responsable/equipo, semana (`WK`), Work Order y rango de meses. Seleccionar una barra, una causa, una estación, una leyenda o un área aplica el filtro relacionado; el mismo elemento permite quitarlo. Las gráficas y el detalle comparten el conjunto filtrado.

| Gráfica | Qué muestra |
| --- | --- |
| **Pareto de fallas** | Principales tipos de falla y porcentaje acumulado; permite filtrar por tipo. |
| **Eventos y seriales por área** | Filas de falla y seriales únicos para cada área; permite filtrar por área. |
| **Fallas por estación** | Conteos por estación; permite filtrar por estación. |
| **Distribución de fallas** | Participación de los tipos de falla, agrupando los tipos menores en “Otros” cuando aplica. |

Las tarjetas de acciones muestran acciones abiertas, vencidas, sin fecha compromiso y sin evidencia de verificación. Las acciones vencidas se ordenan primero.

## 6. Seguimiento de Work Orders y acciones

### Impacto por WO

El resumen de Work Orders separa cuatro cantidades para evitar mezclar eventos con unidades:

- **Eventos:** filas de falla de la WO.
- **Seriales fallados:** seriales únicos de esa WO.
- **Seriales repetidos:** seriales con más de un evento en esa WO.
- **Unidades procesadas:** denominador que captura el usuario.

La tasa de seriales afectados es `seriales únicos fallados ÷ unidades procesadas`. Solo se calcula si las unidades son un entero mayor que cero y no son menores que el número de seriales fallados. En otro caso, el porcentaje se deja sin calcular.

### Cierre efectivo de acción

Cada acción puede tener responsable, fecha compromiso, fase, efectividad, fecha de verificación y evidencia de verificación. Las fases son `PENDIENTE`, `EN PROCESO`, `EN VERIFICACIÓN` y `CERRADA`; la efectividad puede ser `PENDIENTE`, `EFECTIVA` o `NO EFECTIVA`.

Una acción se considera cerrada únicamente cuando cumple todo lo siguiente:

- Fase `CERRADA`.
- Efectividad `EFECTIVA`.
- Fecha de verificación capturada.
- Evidencia de verificación capturada.

Si se selecciona `CERRADA` sin completar esos datos, la aplicación la regresa a `EN VERIFICACIÓN` y muestra un aviso. La fecha compromiso permite calcular vencimientos.

## 7. Detalle del formato RCCA

La tabla se organiza en los grupos de columnas del formato FQ-3264-INT-NVD:

1. **Identificación:** WO, semana, familia, modelo, serial, estación, fechas y turno.
2. **Falla y asignación:** información de falla, síntoma/defecto, ubicación y OWNER.
3. **Seguimiento RCCA:** evidencia, evidencia instrumental, categoría de causa raíz, análisis RC, contención, acción correctiva/preventiva, status, status post-rework y comentarios.
4. **Fuente:** `REMARK` del reporte.

Los campos RCCA que no vienen en el archivo se pueden completar en la tabla. Hay listas guía para causas, análisis, contención y acción correctiva/preventiva; sus campos siguen siendo editables. La tabla conserva los datos fuente y permite adjuntar evidencia a los campos de evidencia.

> La selección de un archivo de evidencia guarda su nombre en el registro local; este flujo no carga el contenido del archivo a un servidor.

## 8. Exportación Excel

**Exportar Excel** crea un libro con cuatro hojas y usa los registros que coinciden con los filtros actuales:

| Hoja | Contenido |
| --- | --- |
| `Resumen` | Filtros aplicados, indicadores y distribuciones principales. |
| `Control WO` | Eventos, seriales fallados/repetidos, unidades, porcentaje afectado, acciones abiertas y vencidas, además de tendencia mensual. |
| `Acciones` | Acción correctiva, responsable, compromiso, fase, efectividad, fecha y evidencia de verificación. |
| `RCCA Registro` | Columnas del formato RCCA, campos editables y `REMARK`. |

El resumen puede incluir barras proporcionales en celdas de Excel; no son gráficos nativos de Excel.

## 9. Almacenamiento y privacidad

El procesamiento del reporte fuente ocurre en el navegador. Los registros importados permanecen en memoria de la página y se deben volver a importar después de recargarla. Las capturas locales, las ediciones RCCA, los datos de WO/acciones y el tema se guardan en `localStorage` del navegador.

Esto significa que:

- Los datos guardados pertenecen al navegador, perfil y origen del sitio donde se capturaron; no se sincronizan entre personas ni equipos.
- Borrar los datos del sitio o usar otro navegador puede hacer que esas capturas y ediciones ya no estén disponibles.
- El reporte original no se modifica.
- Los archivos de evidencia no se almacenan en un servidor; actualmente se conserva el nombre seleccionado.

Claves actuales de almacenamiento local:

- `rcca-dashboard-local-records-v2`: registros capturados manualmente.
- `rcca-dashboard-rcca-notes-v1`: ediciones de los campos RCCA para filas importadas o locales.
- `rcca-dashboard-manager-followup-v1`: unidades por WO y datos de seguimiento de acciones.
- `rcca-theme`: tema claro u oscuro.

No hay una base de datos central ni inicio de sesión en esta versión.

## 10. Arquitectura y archivos

| Archivo | Responsabilidad |
| --- | --- |
| `rcca-dashboard.html` | Interfaz, estilos, importación, normalización de filas, filtros, gráficas, vistas, captura y exportación. |
| `rcca-domain.js` | Normalización de áreas, reglas locales de clasificación, IDs de eventos y conteos por área. |
| `rcca-detail-table.js` | Grupos/columnas RCCA, controles editables y datos de columnas para exportar. |
| `rcca-manager.js` | Cálculos por WO, validez de tasas, seguimiento de acciones, tendencia mensual y Pareto. |
| `rcca-dashboard-ui.js` | Interacción accesible para aplicar/quitar filtros desde las gráficas. |
| `rcca-server.js` | Servidor HTTP local, recursos estáticos y endpoints opcionales de estado/clasificación. |
| `index.html` | Redirige a `rcca-dashboard.html`. |
| `ingrasys-emblem.png` | Emblema de Ingrasys usado por la interfaz. |
| `package.json`, `package-lock.json` | Dependencias y comandos npm. |
| `*.test.js` | Pruebas de dominio, tabla, gestión, interfaz y servidor. |
| `.github/workflows/deploy-pages.yml` | Workflow de publicación existente de GitHub Pages; ver la advertencia de publicación más abajo. |

### Servidor local y clasificación opcional

El servidor usa Node.js y escucha en `127.0.0.1`; el puerto predeterminado es `4310` y se puede cambiar con `PORT`.

- `GET /api/status` devuelve `{ "configured": true/false }` según si existen una URL válida y un modelo configurado.
- `POST /api/classify` es un endpoint preparado para un proveedor de IA compatible con el formato de Chat Completions. Acepta lotes de 1 a 20 eventos, limita el cuerpo a 256 KB y el texto de cada campo a 2,400 caracteres.
- El endpoint requiere `AI_BASE_URL` y `AI_MODEL`. `AI_API_KEY` es opcional para proveedores que no exigen autenticación.
- Sin configuración del proveedor, `/api/classify` responde HTTP 503 por diseño.
- La interfaz actual clasifica con reglas locales y no invoca este endpoint de IA.

La ausencia de un proveedor de IA no impide abrir el dashboard, importar reportes, filtrar o usar las reglas locales.

## 11. Requisitos y operación local

Requisitos: Node.js 18 o posterior y npm. Desde la raíz del repositorio:

```bash
npm ci
npm test
npm run dev
```

El servidor imprime la dirección local al iniciar. Abre `http://127.0.0.1:4310/` para usar el dashboard. Para comprobar el endpoint local de estado:

```bash
curl --fail http://127.0.0.1:4310/api/status
```

Una respuesta `{"configured":false}` indica que no está configurado el proveedor de IA opcional; el dashboard y la clasificación local siguen disponibles.

El archivo `.env` no debe añadirse al repositorio. Configura cualquier credencial requerida únicamente en el entorno seguro del servidor.

## 12. Pruebas

`npm test` ejecuta las pruebas Node.js incluidas en el proyecto. Cubren, entre otras cosas:

- Clasificación y normalización de áreas.
- Diferencia entre eventos, seriales únicos y seriales repetidos.
- Cálculo de tasas solo con denominadores válidos.
- Criterios para cerrar acciones y detectar vencimientos.
- Tendencias mensuales y porcentajes acumulados del Pareto.
- Renderizado/contrato de la tabla RCCA, filtros de gráficas y endpoints del servidor.

## 13. Estado de publicación

Por instrucción del propietario, **el sitio no se debe publicar todavía**. No generar ni subir carpetas `dist` o `_site`, ni ejecutar un deploy.

El workflow `.github/workflows/deploy-pages.yml` queda limitado al evento manual `workflow_dispatch`; los pushes a `develop` no publican el sitio automáticamente. No ejecutar el workflow manual ni publicar hasta que el propietario lo autorice expresamente. Este cambio de documentación no genera una carpeta de publicación ni inicia un deploy.
