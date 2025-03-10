import { connect } from '@planetscale/database'
const express = require("express");
const fileUpload = require('express-fileupload');
const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const app = express();
const xlsx= require('xlsx');
app.use(express.json());
const PORT = 3000;
const moment = require("moment");
app.use(cors());
app.use(express.static('frontend'));
app.use(fileUpload());

const config2 = mysql.createPool({
  host: "186.95.149.118",
  user: "usuario",
  password: "admin",
  database: "llantas",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const config = mysql.createPool({
  host: "186.95.149.118", 
  user: "usuario",
  password: "admin",
  database: "servicios",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
const pool = connect(config)
const pool_ll = connect(config)
app.post("/api/login", async (req, res) => {
    const { usuario, contrasena } = req.body;
    
    try {
        const [rows] = await pool_ll.query(
            "SELECT tipo FROM usuarios WHERE usuario = ? AND password = SHA2(?, 256)",
            [usuario, contrasena]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: "Usuario o contraseña incorrectos." });
        }
        console.log("Usuario autenticado:", usuario, "Tipo:", rows[0].tipo); // Depuración
        res.json({ tipo: rows[0].tipo });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: "Error en el servidor." });
    }
});

app.post("/api/agregar_usuario", async (req, res) => {
  const { usuario, contrasena, tipo } = req.body;
  try {
      await pool_ll.query("INSERT INTO usuarios (usuario, password, tipo) VALUES (?, SHA2(?, 256), ?)", [usuario, contrasena, tipo]);
      res.status(201).json({ message: "Usuario agregado correctamente" });
  } catch (error) {
      res.status(500).json({ error: "Error al agregar usuario" });
  }
});

app.get("/api/consultar_rutas", async (req, res) => {
  const { textoBusqueda = "", estatus } = req.query;
  let conn;
  try {
    conn = await pool.getConnection();
    const params = [
      `%${textoBusqueda.toLowerCase()}%`,
      `%${textoBusqueda.toLowerCase()}%`,
      `%${textoBusqueda.toLowerCase()}%`,
      `%${textoBusqueda.toLowerCase()}%`,
      `%${textoBusqueda.toLowerCase()}%`,
    ];

    let queryRutas = `
      SELECT r.ruta, f.tracking, r.cporte, r.bol, c.origen_destino, r.fecha_cita, 
             c.nombre_cliente AS cliente, u.numero_unidad, cj.numero_caja, o.nombre_operador, 
             r.estatus, r.fec_real_llegada, r.fec_real_salida, r.comentarios
      FROM rutas r
      LEFT JOIN clientes c ON r.ruta = c.ruta
      LEFT JOIN fechas f ON r.id_fecha = f.id_fecha
      LEFT JOIN operadores o ON r.id_operador = o.id_operador
      LEFT JOIN unidades u ON r.id_unidad = u.id_unidad
      LEFT JOIN cajas cj ON r.id_caja = cj.id_caja
      WHERE LOWER(f.tracking) LIKE ? OR LOWER(c.nombre_cliente) LIKE ? 
            OR LOWER(c.origen_destino) LIKE ? OR LOWER(cj.numero_caja) LIKE ? 
            OR LOWER(o.nombre_operador) LIKE ?
    `;

    let queryHistorico = `
      SELECT h.ruta, f.tracking, h.cporte, h.bol, c.origen_destino, h.fecha_cita, 
             c.nombre_cliente AS cliente, u.numero_unidad, cj.numero_caja, o.nombre_operador, 
             h.estatus, h.fec_real_llegada, h.fec_real_salida, h.comentarios
      FROM historico h
      LEFT JOIN clientes c ON h.ruta = c.ruta
      LEFT JOIN fechas f ON h.id_fecha = f.id_fecha
      LEFT JOIN operadores o ON h.id_operador = o.id_operador
      LEFT JOIN unidades u ON h.id_unidad = u.id_unidad
      LEFT JOIN cajas cj ON h.id_caja = cj.id_caja
      WHERE LOWER(f.tracking) LIKE ? OR LOWER(c.nombre_cliente) LIKE ? 
            OR LOWER(c.origen_destino) LIKE ? OR LOWER(cj.numero_caja) LIKE ? 
            OR LOWER(o.nombre_operador) LIKE ?
    `;

    let queryEstatusRutas = `
      SELECT r.ruta, f.tracking, r.cporte, r.bol, c.origen_destino, r.fecha_cita, 
             c.nombre_cliente AS cliente, u.numero_unidad, cj.numero_caja, o.nombre_operador, 
             r.estatus, r.fec_real_llegada, r.fec_real_salida, r.comentarios
      FROM rutas r
      LEFT JOIN clientes c ON r.ruta = c.ruta
      LEFT JOIN fechas f ON r.id_fecha = f.id_fecha
      LEFT JOIN operadores o ON r.id_operador = o.id_operador
      LEFT JOIN unidades u ON r.id_unidad = u.id_unidad
      LEFT JOIN cajas cj ON r.id_caja = cj.id_caja
      WHERE r.estatus = ?
    `;

    let queryEstatusHistorico = `
      SELECT h.ruta, f.tracking, h.cporte, h.bol, c.origen_destino, h.fecha_cita, 
             c.nombre_cliente AS cliente, u.numero_unidad, cj.numero_caja, o.nombre_operador, 
             h.estatus, h.fec_real_llegada, h.fec_real_salida, h.comentarios
      FROM historico h
      LEFT JOIN clientes c ON h.ruta = c.ruta
      LEFT JOIN fechas f ON h.id_fecha = f.id_fecha
      LEFT JOIN operadores o ON h.id_operador = o.id_operador
      LEFT JOIN unidades u ON h.id_unidad = u.id_unidad
      LEFT JOIN cajas cj ON h.id_caja = cj.id_caja
      WHERE h.estatus = ?
    `;
    
    if (estatus) {
      const estatusArray = Array.isArray(estatus) ? estatus : estatus.split(",");
      const result = [];

      for (const est of estatusArray) {
        if (['Asignada', 'Sin asignar'].includes(est)) {
          const [rowsRutas] = await conn.query(queryEstatusRutas, [est]);
          const resultRutas = rowsRutas.map((row) => Object.values(row));
          result.push(...resultRutas);
        } else if (['Cancelada', 'Terminada'].includes(est)) {
          const [rowsHistorico] = await conn.query(queryEstatusHistorico, [est]);
          const resultHistorico = rowsHistorico.map((row) => Object.values(row));
          result.push(...resultHistorico);
        }
      }

      return res.json(result);
    }

    const [rowsRutas] = await conn.query(queryRutas, params);
    const [rowsHistorico] = await conn.query(queryHistorico, params);
    const procesarFila = (fila) =>
      fila.map((x, i) =>
        x === null && i !== 13 ? "/" : x === null && i === 13 ? "" : x
      );

    const resultRutas = rowsRutas.map((row) => procesarFila(Object.values(row)));
    const resultHistorico = rowsHistorico.map((row) =>
      procesarFila(Object.values(row))
    );
    res.json([...resultRutas, ...resultHistorico]);
  } catch (error) {
    console.error("Error al consultar rutas e histórico:", error);
    res.status(500).json({ error: "Error al consultar datos.", details: error.message });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/operadores', async (req, res) => {
  try {
      const [results] = await pool.query('SELECT id_operador, nombre_operador FROM operadores');
      res.json(results);
  } catch (err) {
      console.error('Error al obtener operadores:', err);
      res.status(500).send('Error al obtener operadores');
  }
});

app.get('/api/cajas', async (req, res) => {
  try {
      const [results] = await pool.query('SELECT id_caja, numero_caja FROM cajas');
      res.json(results);
  } catch (err) {
      console.error('Error al obtener cajas:', err);
      res.status(500).send('Error al obtener cajas');
  }
});
+
app.get('/api/unidades', async (req, res) => {
  try {
      const [results] = await pool.query('SELECT id_unidad, numero_unidad FROM unidades');
      res.json(results);
  } catch (err) {
      console.error('Error al obtener unidades:', err);
      res.status(500).send('Error al obtener unidades');
  }
}); 

app.post("/api/asignar", async (req, res) => {
  const {
    id_ruta,
    fecha_cita,
    cporte,
    id_unidad,
    id_caja,
    id_operador,
    vol,
    confirmar_cambio = false,
  } = req.body;

  try {
    const queryVerificarFecha = 'SELECT fecha_cita FROM rutas WHERE id_ruta = ?';
    const [resultFecha] = await pool.query(queryVerificarFecha, [id_ruta]);

    let fechaCitaCompleta = moment(fecha_cita).format("YYYY-MM-DD HH:mm:ss");

    if (resultFecha.length > 0 && resultFecha[0].fecha_cita) {
      const fechaCitaExistente = resultFecha[0].fecha_cita;

      if (fechaCitaExistente !== fecha_cita && !confirmar_cambio) {
        return res.status(200).json({
          mensaje: `La ruta ya tiene asignada una fecha de cita:\n${fechaCitaExistente}\n¿Deseas sobrescribirla?`,
          requiereConfirmacion: true,
          fecha_cita_existente: fechaCitaExistente,
        });
      }

      if (!confirmar_cambio) {
        fechaCitaCompleta = fechaCitaExistente;
      }
    }

    const queryCliente = `
      SELECT r.ruta, c.origen_destino, c.litros, c.kms, c.rendimiento, c.viaticos, c.caseta, c.sueldo, c.ingresos 
      FROM rutas r
      INNER JOIN clientes c ON r.ruta = c.ruta
      WHERE id_ruta = ?`;
    const [resultCliente] = await pool.query(queryCliente, [id_ruta]);

    if (resultCliente.length === 0) {
      return res
        .status(404)
        .json({ error: "No se encontraron datos para el cliente seleccionado." });
    }
    
    let {
      origen_destino,
      litros,
      kms,
      rendimiento,
      ingresos,
      viaticos,
      caseta,
      sueldo,
    } = resultCliente[0];
    const precio_gasolina = 25;
    litros = parseFloat(litros) || 0;
    ingresos = parseFloat(ingresos) || 0;
    viaticos = parseFloat(viaticos) || 0;
    caseta = parseFloat(caseta) || 0;
    sueldo = parseFloat(sueldo) || 0;

    const diesel = litros * precio_gasolina;
    const gastos = viaticos + caseta + sueldo;
    const utilidad = ingresos - (diesel + gastos);
    let porcentaje_utilidad = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
    porcentaje_utilidad = Math.max(porcentaje_utilidad, 0);

    const queryActualizarRuta = `
      UPDATE rutas
      SET fecha_cita = ?, cporte = ?, id_unidad = ?, id_caja = ?, id_operador = ?, 
          origen_destino = ?, kms = ?, litros = ?, rendimiento = ?, diesel = ?, 
          viaticos = ?, casetas = ?, sueldo = ?, ingresos = ?, utilidad = ?, porcentaje_utilidad = ?, estatus = 'Asignada', bol = ?
      WHERE id_ruta = ?`; 

    const [resultActualizar] = await pool.query(queryActualizarRuta, [
      fechaCitaCompleta,
      cporte,
      id_unidad,
      id_caja,
      id_operador,
      origen_destino,
      kms,
      litros,
      rendimiento,
      diesel,
      viaticos,
      caseta,
      sueldo,
      ingresos,
      utilidad,
      porcentaje_utilidad,
      vol,
      id_ruta,
    ]);

    if (resultActualizar.affectedRows > 0) {
      res.json({ mensaje: "Ruta asignada correctamente." });
    } else {
      res.status(404).json({ error: "No se encontró la ruta para asignar." });
    }
  } catch (err) {
    console.error("Error al asignar datos:", err);
    res.status(500).json({ error: "Error al asignar datos." });
  }
});
//consultar rutas con estatus sin asignar
app.get('/api/crutas', async (req, res) => {
  try {
      const query = `
          SELECT 
              r.id_ruta, 
              r.tracking, 
              r.ruta, 
              o.nombre_operador AS operador, 
              c.numero_caja AS caja, 
              u.numero_unidad AS unidad
          FROM rutas r
          LEFT JOIN operadores o ON r.id_operador = o.id_operador
          LEFT JOIN cajas c ON r.id_caja = c.id_caja
          LEFT JOIN unidades u ON r.id_unidad = u.id_unidad
          WHERE r.estatus = 'Sin asignar'`;

      const [results] = await pool.query(query);
      res.json(results);
  } catch (err) {
      console.error('Error al obtener rutas:', err);
      res.status(500).send('Error al obtener rutas');
  }
});

app.get('/api/rutas/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [results] = await pool.query('SELECT fecha_cita FROM rutas WHERE id_ruta = ?', [id]);
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            res.status(404).send('Ruta no encontrada');
        }
    } catch (err) {
        console.error('Error al obtener ruta:', err);
        res.status(500).send('Error al obtener ruta');
    }
});

app.get('/api/clientes', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT DISTINCT nombre_cliente FROM clientes');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/nuevarutas', async (req, res) => {
    const { cliente } = req.query;
    try {
        const [rows] = await pool.query('SELECT ruta FROM clientes WHERE nombre_cliente = ?', [cliente]);
        res.json(rows.map(row => row.ruta));
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/rutas', async (req, res) => {
  const { tracking, cliente, ruta } = req.body;

  try {

      const [exists] = await pool.query(
          'SELECT COUNT(*) as count FROM rutas WHERE tracking = ?',
          [tracking]
      );

      if (exists[0].count > 0) {
          return res.status(400).json({ success: false, message: 'El tracking ya existe' });
      }

      const [result] = await pool.query(
          'SELECT id_cliente FROM clientes WHERE nombre_cliente = ? AND ruta = ?',
          [cliente, ruta]
      );

      if (!result.length) {
          return res.status(400).json({ success: false, message: 'Cliente o ruta no válidos' });
      }

      const idCliente = result[0].id_cliente;

      await pool.query(
          'INSERT INTO fechas (fecha, tracking, id_cliente, ruta) VALUES (CURDATE(), ?, ?, ?)',
          [tracking, idCliente, ruta]
      );
      await pool.query(
          'INSERT INTO rutas (id_fecha, tracking, cliente, ruta, estatus) VALUES (LAST_INSERT_ID(), ?, ?, ?, "Sin asignar")',
          [tracking, cliente, ruta]
      );

      res.json({ success: true });
  } catch (error) {
      res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/procesar-archivo', async (req, res) => {
  try {
      if (!req.files || !req.files.archivo) {
          return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo.' });
      }

      const archivo = req.files.archivo;
      const workbook = xlsx.read(archivo.data, { type: 'buffer' }); // Leer archivo Excel
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]); // Convertir a JSON

      const columnasNecesarias = ["ID de la Carga", "# de Rastreo de la Carga", "Llegada Programada"];
      const columnasValidas = columnasNecesarias.every(col => data[0] && col in data[0]);

      if (!columnasValidas) {
          return res.status(400).json({ 
              success: false, 
              message: `El archivo debe contener las columnas: ${columnasNecesarias.join(", ")}.` 
          });
      }

      let rutasInsertadas = 0;
      let rutasDuplicadas = 0;
      let rutasInvalidas = 0;

      for (const row of data) {
          const tracking = row["ID de la Carga"]?.toString().trim(); // ID de la carga
          const rutaCompleta = row["# de Rastreo de la Carga"]?.toString().trim();
          const ruta = rutaCompleta ? rutaCompleta.substring(0, 6) : null; // Primeros 6 caracteres
          const llegadaProgramada = row["Llegada Programada"]?.toString().trim();

          if (!tracking || !ruta || !llegadaProgramada) {
              rutasInvalidas++;
              continue;
          }

          const fechaHora = new Date(llegadaProgramada);
          if (isNaN(fechaHora)) {
              rutasInvalidas++;
              continue;
          }
          const fechaCita = `${fechaHora.toISOString().split("T")[0]} ${fechaHora.toTimeString().split(" ")[0]}`;

          const [exists] = await pool.query(
              'SELECT COUNT(*) as count FROM fechas WHERE tracking = ?',
              [tracking]
          );

          if (exists[0].count > 0) {
              rutasDuplicadas++;
              continue;
          }
          const [cliente] = await pool.query(
              'SELECT id_cliente, nombre_cliente FROM clientes WHERE ruta = ?',
              [ruta]
          );

          if (!cliente.length) {
              rutasInvalidas++;
              continue;
          }

          const { id_cliente, nombre_cliente } = cliente[0];

          await pool.query(
              'INSERT INTO fechas (fecha, tracking, id_cliente, ruta) VALUES (CURDATE(), ?, ?, ?)',
              [tracking, id_cliente, ruta]
          );

          await pool.query(
              'INSERT INTO rutas (id_fecha, tracking, cliente, ruta, fecha_cita, estatus) VALUES (LAST_INSERT_ID(), ?, ?, ?, ?, "Sin asignar")',
              [tracking, nombre_cliente, ruta, fechaCita]
          );
          rutasInsertadas++;
      }

      res.json({
          success: true,
          message: 'Archivo procesado correctamente',
          resumen: {
              rutasInsertadas,
              rutasDuplicadas,
              rutasInvalidas
          }
      });
  } catch (error) {
      console.error(`Error al procesar el archivo: ${error.message}`);
      res.status(500).json({ success: false, message: `Error al procesar el archivo: ${error.message}` });
  }
});

app.get("/api/detalle_tracking", async (req, res) => {
  const { tracking, estatus } = req.query;
  if (!tracking || !estatus) {
    return res.status(400).json({ error: "Se requiere tracking y estatus." });
  }
  const tabla = estatus === "Terminada" || estatus === "Cancelada" ? "historico" : "rutas";
  const query = `
    SELECT 
      f.id_fecha AS Id,
      f.tracking AS Tracking,
      t.bol AS Bol,
      c.nombre_cliente AS Cliente,
      f.ruta AS Ruta,
      t.fecha_cita AS 'Fecha Cita',
      t.cporte AS C_Porte,
      u.numero_unidad AS Unidad,
      cj.numero_caja AS Caja,
      o.nombre_operador AS 'Nombre Operador',
      c.origen_destino AS 'Origen/Destino',
      t.diesel AS Diesel,
      t.sueldo AS Sueldo,
      t.casetas AS Casetas,
      t.viaticos AS Viaticos,
      t.gastos AS Gastos,
      t.ingresos AS Ingresos,
      t.utilidad AS Utilidad,
      t.porcentaje_utilidad AS 'Porcentaje Utilidad',
      c.kms AS Kms,
      t.litros AS Litros,
      c.rendimiento AS Rendimiento,
      t.comentarios AS Comentarios,
      t.fec_real_llegada AS 'Fec Real Llegada',
      t.fec_real_salida AS 'Fec Real Salida',
      t.fec_terminada AS 'Fec Terminada'
    FROM ${tabla} t
    INNER JOIN fechas f ON t.id_fecha = f.id_fecha
    LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
    LEFT JOIN operadores o ON t.id_operador = o.id_operador
    LEFT JOIN cajas cj ON t.id_caja = cj.id_caja
    LEFT JOIN unidades u ON t.id_unidad = u.id_unidad
    WHERE t.tracking = ?
  `;
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query(query, [tracking]);
    if (rows.length === 0) {
      return res.status(404).json({ error: `No se encontraron datos para el tracking '${tracking}'` });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener detalle del tracking:", error);
    res.status(500).json({ error: "Error al obtener detalle del tracking." });
  }
});

app.put('/api/actualizar_tracking', async (req, res) => {
  try {
    const { tracking, tabla, cambios } = req.body;

    if (!tracking || !tabla || !cambios) {
      return res.status(400).send({ error: 'Faltan parámetros necesarios (tracking, tabla, cambios)' });
    }


    delete cambios.Id;
    const columnMapping = {
      "Fecha Cita": "fecha_cita",
      "Nombre Operador": "id_operador",
      "Unidad": "id_unidad",
      "Caja": "id_caja",
      "Bol": "bol", 
      "C_Porte": "cporte",
      "Origen/Destino": "origen_destino",
      "Diesel": "diesel",
      "Sueldo": "sueldo",
      "Casetas": "casetas",
      "Viaticos": "viaticos",
      "Gastos": "gastos",
      "Ingresos": "ingresos",
      "Utilidad": "utilidad",
      "Porcentaje Utilidad": "porcentaje_utilidad",
      "Kms": "kms",
      "Litros": "litros",
      "Rendimiento": "rendimiento",
      "Comentarios": "comentarios",
      "Fec Real Llegada": "fec_real_llegada",
      "Fec Real Salida": "fec_real_salida",
      "Fec Terminada": "fec_terminada"
    };

    const numericColumns = [
      "id_caja","id_operador","id_caja","diesel", "sueldo", "casetas", "viaticos", "gastos",
      "ingresos", "utilidad", "porcentaje_utilidad", "kms",
      "litros", "rendimiento"
    ];
    const integerColumns = ["id_unidad", "id_caja", "id_operador"];
    const dateColumns = ["fecha_cita", "fec_real_llegada", "fec_real_salida", "fec_terminada"];

    const cambiosBD = {};
    for (let key in cambios) {
      const dbColumn = columnMapping[key] || key;
      let value = cambios[key];
      
      if ((numericColumns.includes(dbColumn) || integerColumns.includes(dbColumn)) && value === "") {
        value = null;
      }
      if (dateColumns.includes(dbColumn) && value === "") {
        value = null;
      }
      cambiosBD[dbColumn] = value;
    }

    if (cambiosBD.id_unidad) {
      const [unidad] = await pool.query("SELECT id_unidad FROM unidades WHERE numero_unidad = ?", [cambiosBD.id_unidad]);
      cambiosBD.id_unidad = unidad.length ? unidad[0].id_u : null;
    }
    if (cambiosBD.id_caja) {
      const [caja] = await pool.query("SELECT id_caja FROM cajas WHERE numero_caja = ?", [cambiosBD.id_caja]);
      cambiosBD.id_caja = caja.length ? caja[0].id_c : null;
    }
    if (cambiosBD.id_operador) {
      const [operador] = await pool.query("SELECT id_operador FROM operadores WHERE nombre_operador = ?", [cambiosBD.id_operador]);
      cambiosBD.id_operador = operador.length ? operador[0].id_op : null;
    }

    const campos = Object.keys(cambiosBD).map(campo => `\`${campo}\` = ?`).join(', ');
    const valores = Object.values(cambiosBD);
    valores.push(tracking);
    const query = `UPDATE \`${tabla}\` SET ${campos} WHERE tracking = ?`;
    await pool.query(query, valores);
    
    const [registro] = await pool.query(`SELECT * FROM \`${tabla}\` WHERE tracking = ?`, [tracking]);
    if (!registro.length) {
      return res.status(404).send({ error: 'Registro no encontrado' });
    }

    const datos = registro[0];

    const precio_gasolina = 25;
    const litros = parseFloat(datos.litros) || 0;
    const ingresos = parseFloat(datos.ingresos) || 0;
    const viaticos = parseFloat(datos.viaticos) || 0;
    const casetas = parseFloat(datos.casetas) || 0;
    const sueldo = parseFloat(datos.sueldo) || 0;
    const gastos = parseFloat(datos.gastos) || 0;

    const diesel = litros * precio_gasolina;
    const gastos_c = viaticos + casetas + sueldo + gastos;
    const utilidad = ingresos - (diesel + gastos_c);
    let porcentaje_utilidad = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
    porcentaje_utilidad = Math.max(porcentaje_utilidad, 0);

    const query_1 = `UPDATE \`${tabla}\` SET diesel = ?, utilidad = ?, porcentaje_utilidad = ? WHERE tracking = ?`;
    const valores_1 = [diesel, utilidad, porcentaje_utilidad, tracking];

    await pool.query(query_1, valores_1);

    res.status(200).send({ message: 'Actualización exitosa' });
  } catch (error) {
    console.error("Error al actualizar tracking:", error);
    res.status(500).send({ error: 'Error al actualizar tracking' });
  }
});

app.get("/api/actualizar_fila", async (req, res) => {
  const { tracking, tabla_origen } = req.query;
  if (!tracking || !tabla_origen) {
      return res.status(400).json({ error: "Se requiere tracking y tabla_origen." });
  }
  const tablasValidas = ['rutas', 'historico'];
  if (!tablasValidas.includes(tabla_origen)) {
      return res.status(400).json({ error: "Tabla de origen no válida." });
  }
  const query = `
      SELECT 
          f.ruta AS Ruta,
          f.tracking AS Tracking, 
          t.cporte AS Cporte,
          t.bol AS Bol,
          c.origen_destino AS Origen_Destino, 
          t.fecha_cita AS Fecha_Cita,
          c.nombre_cliente AS Cliente,
          u.numero_unidad AS Unidad,
          cj.numero_caja AS Caja,
          o.nombre_operador AS Operador,
          t.estatus AS Estatus,
          t.fec_real_llegada AS Fec_real_llegada,
          t.fec_real_salida AS Fec_real_salida,
          t.comentarios AS Comentarios
      FROM ${tabla_origen} t
      LEFT JOIN fechas f ON t.id_fecha = f.id_fecha
      LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
      LEFT JOIN operadores o ON t.id_operador = o.id_operador
      LEFT JOIN cajas cj ON t.id_caja = cj.id_caja
      LEFT JOIN unidades u ON t.id_unidad = u.id_unidad
      WHERE t.tracking = ?
  `;
  try {
      const [rows] = await pool.query(query, [tracking]);
      if (rows.length === 0) {
          return res.status(404).json({ error: "No se encontraron datos para el tracking." });
      }
      const fila = rows[0];
      if (fila.Fecha_Cita === undefined) {
          fila.Fecha_Cita = null;
      }
      res.json(fila);
  } catch (error) {
      console.error("Error al obtener fila actualizada:", error);
      res.status(500).json({ error: "Error al obtener fila actualizada." });
  }
});

app.put('/api/terminar_ruta', async (req, res) => {
  try {
      const { tracking } = req.body;

      if (!tracking) {
          return res.status(400).send({ error: 'Falta el tracking.' });
      }

      const conn = await pool.getConnection();
      const [ruta] = await conn.query(` 
          SELECT id_fecha, tracking, cliente, ruta, cporte, bol, id_unidad, id_caja, id_operador, 
                 origen_destino, diesel, sueldo, casetas, viaticos, gastos, ingresos, 
                 utilidad, porcentaje_utilidad, kms, litros, rendimiento, comentarios, 
                 fecha_cita, fec_real_llegada, fec_real_salida
          FROM rutas 
          WHERE tracking = ?
      `, [tracking]);

      if (ruta.length === 0) {
          conn.release();
          return res.status(404).json({ error: "No se encontró la ruta." });
      }
      const fecactual = new Date();
      const fechaTerminada = fecactual.toLocaleString("sv-SE", { timeZone: "America/Mexico_City" }).replace(",", "");
      const queryInsert = `
          INSERT INTO historico 
          (id_fecha, tracking, cliente, ruta, cporte, bol, id_unidad, id_caja, id_operador, 
           origen_destino, diesel, sueldo, casetas, viaticos, gastos, ingresos, 
           utilidad, porcentaje_utilidad, kms, litros, rendimiento, comentarios, 
           fecha_cita, fec_real_llegada, fec_real_salida, estatus, fec_terminada)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await conn.query(queryInsert, [...Object.values(ruta[0]), "Terminada", fechaTerminada]); 
      await conn.query("DELETE FROM rutas WHERE tracking = ?", [tracking]);
      conn.release();
      res.status(200).send({ message: "Ruta terminada y movida a histórico." });

  } catch (error) {
      console.error("Error al terminar la ruta:", error);
      res.status(500).send({ error: "Error al terminar la ruta." });
  }
});

app.put('/api/terminar_ruta', async (req, res) => {
  try {
      const { tracking } = req.body;

      if (!tracking) {
          return res.status(400).send({ error: 'Falta el tracking.' });
      }

      const conn = await pool.getConnection();
      const [ruta] = await conn.query(`
          SELECT id_fecha, tracking, cliente, ruta, cporte, bol, id_unidad, id_caja, id_operador, 
                 origen_destino, diesel, sueldo, casetas, viaticos, gastos, ingresos, 
                 utilidad, porcentaje_utilidad, kms, litros, rendimiento, comentarios, 
                 fecha_cita, fec_real_llegada, fec_real_salida
          FROM rutas 
          WHERE tracking = ?
      `, [tracking]);

      if (ruta.length === 0) {
          conn.release();
          return res.status(404).json({ error: "No se encontró la ruta." });
      }
      const fecactual = new Date();
      const fechaTerminada = fecactual.toISOString().slice(0, 19).replace("T", " "); 

      const queryInsert = `
          INSERT INTO historico 
          (id_fecha, tracking, cliente, ruta, cporte, bol, id_unidad, id_caja, id_operador, 
           origen_destino, diesel, sueldo, casetas, viaticos, gastos, ingresos, 
           utilidad, porcentaje_utilidad, kms, litros, rendimiento, comentarios, 
           fecha_cita, fec_real_llegada, fec_real_salida, estatus, fec_terminada)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await conn.query(queryInsert, [...Object.values(ruta[0]), "Terminada", fechaTerminada]); 
      await conn.query("DELETE FROM rutas WHERE tracking = ?", [tracking]);

      conn.release();
      res.status(200).send({ message: "Ruta terminada y movida a histórico." });

  } catch (error) {
      console.error("Error al terminar la ruta:", error);
      res.status(500).send({ error: "Error al terminar la ruta." });
  }
});

app.get("/api/exportar_historico", async (req, res) => {
  try {
      const { fechaInicio, fechaFin, estatus } = req.query;
      const connection = await pool.getConnection();
      
      let query = "";
      let params = [];

      if (estatus) {
          if (["Terminada", "Cancelada"].includes(estatus)) {
              query = `SELECT 
                        f.id_fecha AS Id,
                        f.tracking AS Tracking,
                        t.bol AS Bol,
                        c.nombre_cliente AS Cliente,
                        f.ruta AS Ruta,
                        t.fecha_cita AS 'Fecha Cita',
                        t.cporte AS C_Porte,
                        u.numero_unidad AS Unidad,
                        cj.numero_caja AS Caja,
                        o.nombre_operador AS 'Nombre Operador',
                        c.origen_destino AS 'Origen/Destino',
                        c.diesel AS Diesel,
                        c.sueldo AS Sueldo,
                        c.caseta AS Casetas,
                        c.viaticos AS Viaticos,
                        t.gastos AS Gastos,
                        t.ingresos AS Ingresos,
                        t.utilidad AS Utilidad,
                        t.porcentaje_utilidad AS 'Porcentaje Utilidad',
                        c.kms AS Kms,
                        t.litros AS Litros,
                        c.rendimiento AS Rendimiento,
                        t.estatus AS Estatus,
                        t.comentarios AS Comentarios,
                        t.fec_real_llegada AS 'Fec Real Llegada',
                        t.fec_real_salida AS 'Fec Real Salida',
                        t.fec_terminada AS 'Fec Terminada'
                      FROM historico t
                      INNER JOIN fechas f ON t.id_fecha = f.id_fecha
                      LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
                      LEFT JOIN operadores o ON t.id_operador = o.id_operador
                      LEFT JOIN cajas cj ON t.id_caja = cj.id_caja
                      LEFT JOIN unidades u ON t.id_unidad = u.id_unidad
                      WHERE estatus = ?`;
          } else if (["Asignada", "Sin asignar"].includes(estatus)) {
            query = `SELECT 
              f.id_fecha AS Id,
              f.tracking AS Tracking,
              t.bol AS Bol,
              c.nombre_cliente AS Cliente,
              f.ruta AS Ruta,
              t.fecha_cita AS 'Fecha Cita',
              t.cporte AS C_Porte,
              u.numero_unidad AS Unidad,
              cj.numero_caja AS Caja,
              o.nombre_operador AS 'Nombre Operador',
              c.origen_destino AS 'Origen/Destino',
              c.diesel AS Diesel,
              c.sueldo AS Sueldo,
              c.caseta AS Casetas,
              c.viaticos AS Viaticos,
              t.gastos AS Gastos,
              t.ingresos AS Ingresos,
              t.utilidad AS Utilidad,
              t.porcentaje_utilidad AS 'Porcentaje Utilidad',
              c.kms AS Kms,
              t.litros AS Litros,
              c.rendimiento AS Rendimiento,
              t.estatus AS Estatus,
              t.comentarios AS Comentarios,
              t.fec_real_llegada AS 'Fec Real Llegada',
              t.fec_real_salida AS 'Fec Real Salida',
              t.fec_terminada AS 'Fec Terminada'
            FROM rutas t
            INNER JOIN fechas f ON t.id_fecha = f.id_fecha
            LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN operadores o ON t.id_operador = o.id_operador
            LEFT JOIN cajas cj ON t.id_caja = cj.id_caja
            LEFT JOIN unidades u ON t.id_unidad = u.id_unidad
            WHERE estatus = ?`;
          } else {
              return res.status(400).json({ error: "Estatus no válido." });
          }
          params.push(estatus);
      } else {
          query =`SELECT 
                        f.id_fecha AS Id,
                        f.tracking AS Tracking,
                        t.bol AS Bol,
                        c.nombre_cliente AS Cliente,
                        f.ruta AS Ruta,
                        t.fecha_cita AS 'Fecha Cita',
                        t.cporte AS C_Porte,
                        u.numero_unidad AS Unidad,
                        cj.numero_caja AS Caja,
                        o.nombre_operador AS 'Nombre Operador',
                        c.origen_destino AS 'Origen/Destino',
                        c.diesel AS Diesel,
                        c.sueldo AS Sueldo,
                        c.caseta AS Casetas,
                        c.viaticos AS Viaticos,
                        t.gastos AS Gastos,
                        t.ingresos AS Ingresos,
                        t.utilidad AS Utilidad,
                        t.porcentaje_utilidad AS 'Porcentaje Utilidad',
                        c.kms AS Kms,
                        t.litros AS Litros,
                        c.rendimiento AS Rendimiento,
                        t.comentarios AS Comentarios,
                        t.estatus AS Estatus,
                        t.fec_real_llegada AS 'Fec Real Llegada',
                        t.fec_real_salida AS 'Fec Real Salida',
                        t.fec_terminada AS 'Fec Terminada'
                      FROM historico t
                      INNER JOIN fechas f ON t.id_fecha = f.id_fecha
                      LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
                      LEFT JOIN operadores o ON t.id_operador = o.id_operador
                      LEFT JOIN cajas cj ON t.id_caja = cj.id_caja
                      LEFT JOIN unidades u ON t.id_unidad = u.id_unidad
                      UNION SELECT 
              f.id_fecha AS Id,
              f.tracking AS Tracking,
              t.bol AS Bol,
              c.nombre_cliente AS Cliente,
              f.ruta AS Ruta,
              t.fecha_cita AS 'Fecha Cita',
              t.cporte AS C_Porte,
              u.numero_unidad AS Unidad,
              cj.numero_caja AS Caja,
              o.nombre_operador AS 'Nombre Operador',
              c.origen_destino AS 'Origen/Destino',
              c.diesel AS Diesel,
              c.sueldo AS Sueldo,
              c.caseta AS Casetas,
              c.viaticos AS Viaticos,
              t.gastos AS Gastos,
              t.ingresos AS Ingresos,
              t.utilidad AS Utilidad,
              t.porcentaje_utilidad AS 'Porcentaje Utilidad',
              c.kms AS Kms,
              t.litros AS Litros,
              c.rendimiento AS Rendimiento,
              t.comentarios AS Comentarios,
              t.estatus AS Estatus,
              t.fec_real_llegada AS 'Fec Real Llegada',
              t.fec_real_salida AS 'Fec Real Salida',
              t.fec_terminada AS 'Fec Terminada'
            FROM rutas t
            INNER JOIN fechas f ON t.id_fecha = f.id_fecha
            LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN operadores o ON t.id_operador = o.id_operador
            LEFT JOIN cajas cj ON t.id_caja = cj.id_caja
            LEFT JOIN unidades u ON t.id_unidad = u.id_unidad`;
      }
      
      if (fechaInicio && fechaFin) {
          query += " AND fecha_cita BETWEEN ? AND ?";
          params.push(fechaInicio, fechaFin);
      }

      const [rows, fields] = await connection.query(query, params);
      connection.release();

      if (rows.length === 0) {
          return res.status(404).json({ error: "No hay datos para exportar con los filtros seleccionados." });
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Histórico Filtrado");

      worksheet.addRow(fields.map(field => field.name));
      rows.forEach(row => worksheet.addRow(Object.values(row)));

      res.setHeader("Content-Disposition", "attachment; filename=historico.xlsx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      await workbook.xlsx.write(res);
      res.end();
  } catch (error) {
      console.error("Error al generar el archivo Excel:", error);
      res.status(500).json({ error: "No se pudo generar el archivo Excel." });
  }
});

app.post("/agregar_caja", async (req, res) => {
  const { numero_caja } = req.body;
  if (!numero_caja) {
    return res.status(400).json({ mensaje: "El campo número de caja es obligatorio." });
  }

  try {
    const conn = await pool.getConnection();
    await conn.query("INSERT INTO cajas (numero_caja) VALUES (?)", [numero_caja]);
    conn.release();
    res.status(201).json({ mensaje: "Caja agregada correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al agregar la caja.", error });
  }
});

// Ruta para agregar un operador
app.post("/agregar_operador", async (req, res) => {
  const { nombre_operador } = req.body;
  if (!nombre_operador) {
    return res.status(400).json({ mensaje: "El campo nombre del operador es obligatorio." });
  }

  try {
    const conn = await pool.getConnection();
    await conn.query("INSERT INTO operadores (nombre_operador) VALUES (?)", [nombre_operador]);
    conn.release();
    res.status(201).json({ mensaje: "Operador agregado correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al agregar el operador.", error });
  }
});

// Ruta para agregar una unidad
app.post("/agregar_unidad", async (req, res) => {
  const { numero_unidad } = req.body;
  if (!numero_unidad) {
    return res.status(400).json({ mensaje: "El campo número de unidad es obligatorio." });
  }

  try {
    const conn = await pool.getConnection();
    await conn.query("INSERT INTO unidades (numero_unidad) VALUES (?)", [numero_unidad]);
    conn.release();
    res.status(201).json({ mensaje: "Unidad agregada correctamente." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al agregar la unidad.", error });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
